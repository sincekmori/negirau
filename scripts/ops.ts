/**
 * The operator's daily review as a CLI — a thin wrapper around the exact SQL
 * the operator would type into wrangler by hand (no admin UI, by design).
 * Costs nothing beyond the queries themselves: every statement is keyed by a
 * single subject or bounded by the request queue's size.
 *
 *   bun run ops review               # new subjects (48h) + the request queue
 *   bun run ops apply <id>           # apply the pending update request
 *   bun run ops delete <id>          # delete request -> quarantine (step 1)
 *   bun run ops finalize <id>        # quarantined -> removed (after 14 days)
 *   bun run ops restore <id>         # quarantined -> active (objection upheld)
 *   bun run ops counts <id>          # exact per-type totals (operator-only)
 *   bun run ops purge [id]           # removed -> gone: delete the rows for real
 *
 * Targets --env local | development | production. The default is development:
 * touching the production DB is a deliberate act, never a forgotten flag.
 */

import { unstable_readConfig } from "wrangler";

import { ROLLUP_WATCH_THRESHOLD } from "../app/lib/server/db";

const SUBCOMMANDS = [
	"review",
	"apply",
	"delete",
	"finalize",
	"restore",
	"counts",
	"purge",
] as const;
/** Subcommands that act on the whole table, so they take no subject id. */
const WITHOUT_ID: readonly Subcommand[] = ["review", "purge"];
type Subcommand = (typeof SUBCOMMANDS)[number];

/** Database names come from wrangler.jsonc — the one file a fork edits. */
function databaseName(env: string | undefined): string {
	const config = unstable_readConfig({ config: "wrangler.jsonc", env });
	const name = config.d1_databases[0]?.database_name;
	if (name === undefined) {
		throw new Error("wrangler.jsonc declares no d1_databases entry");
	}
	return name;
}

const rootDb = databaseName(undefined);
const TARGETS = {
	local: { db: rootDb, flags: ["--local"] },
	development: { db: databaseName("dev"), flags: ["--env", "dev", "--remote"] },
	production: { db: rootDb, flags: ["--remote"] },
} as const;

function wranglerArgs(): { db: string; flags: readonly string[] } {
	const flagIndex = process.argv.indexOf("--env");
	const target = flagIndex === -1 ? "development" : (process.argv.at(flagIndex + 1) ?? "");
	if (!(target in TARGETS)) {
		console.error(`usage: --env <${Object.keys(TARGETS).join("|")}> (default: development)`);
		process.exit(1);
	}
	return TARGETS[target as keyof typeof TARGETS];
}

async function execute(sql: string): Promise<unknown> {
	const { db, flags } = wranglerArgs();
	const proc = Bun.spawn(
		// Remote writes prompt for confirmation; this runs non-interactively, and
		// the deliberate act is already the explicit `--env production`.
		["bunx", "wrangler", "d1", "execute", db, ...flags, "--yes", "--json", "--command", sql],
		{ stdout: "pipe", stderr: "pipe" },
	);
	const [stdout, stderr, exitCode] = await Promise.all([
		new Response(proc.stdout).text(),
		new Response(proc.stderr).text(),
		proc.exited,
	]);
	if (exitCode !== 0) {
		// wrangler reports some failures on stdout: showing only stderr swallows them.
		throw new Error(
			[stderr, stdout].filter(Boolean).join("\n").trim() || `wrangler exited ${exitCode}`,
		);
	}
	const parsed = JSON.parse(stdout) as { results: unknown[] }[];
	return parsed.flatMap((statement) => statement.results);
}

/** Subject ids are UUIDs or operator slugs; anything else never reaches SQL. */
function subjectId(): string {
	const id = process.argv.at(3);
	if (id === undefined || !/^[A-Za-z0-9-]+$/.test(id)) {
		throw new Error("usage: bun run ops <subcommand> <subject-id>");
	}
	return id;
}

const byId = (id: string) => `(SELECT rowid FROM subjects WHERE id = '${id}')`;

const STATEMENTS: Record<Subcommand, (id: string) => string> = {
	// Both branches windowed on rowid (creation order) so a spam wave cannot
	// make the review scan — or the console dump — grow without bound. The
	// second statement is the rollup watch (see reactionRowsGauge in
	// app/lib/server/db.ts): MAX(rowid) approximates rows ever inserted for
	// 1 scanned row; execute() flattens both result sets into one table.
	review: () => `
		SELECT 'new' AS section, id, name, status, listed, created_at, NULL AS kind, NULL AS payload
		  FROM (SELECT * FROM subjects ORDER BY rowid DESC LIMIT 200)
		 WHERE created_at >= datetime('now', '-2 days')
		UNION ALL
		SELECT 'request', s.id, s.name, s.status, s.listed, sr.created_at, sr.kind, sr.payload
		  FROM (SELECT * FROM subject_requests ORDER BY rowid DESC LIMIT 200) sr
		  JOIN subjects s ON s.rowid = sr.subject_rowid
		ORDER BY section, created_at DESC;
		SELECT COALESCE(MAX(rowid), 0) AS reaction_rows, ${ROLLUP_WATCH_THRESHOLD} AS rollup_watch
		  FROM reaction_counts`,
	// json_extract maps JSON true/false straight onto the listed INTEGER; the
	// FTS trigger keeps the search index in sync with the new name. The join
	// is empty when no update request is pending, so nothing changes.
	apply: (id) => `
		UPDATE subjects SET
		  name = json_extract(r.payload, '$.name'),
		  listed = json_extract(r.payload, '$.listed')
		FROM (SELECT payload FROM subject_requests
		      WHERE subject_rowid = ${byId(id)} AND kind = 'update') AS r
		WHERE id = '${id}';
		DELETE FROM subject_requests WHERE subject_rowid = ${byId(id)} AND kind = 'update';
		SELECT id, name, status, listed FROM subjects WHERE id = '${id}'`,
	delete: (id) => `
		UPDATE subjects SET status = 'quarantined' WHERE id = '${id}';
		DELETE FROM subject_requests WHERE subject_rowid = ${byId(id)} AND kind = 'delete';
		SELECT id, name, status FROM subjects WHERE id = '${id}'`,
	finalize: (id) => `
		UPDATE subjects SET status = 'removed', created_ip = NULL WHERE id = '${id}' AND status = 'quarantined';
		SELECT id, name, status FROM subjects WHERE id = '${id}'`,
	restore: (id) => `
		UPDATE subjects SET status = 'active' WHERE id = '${id}' AND status = 'quarantined';
		SELECT id, name, status FROM subjects WHERE id = '${id}'`,
	counts: (id) => `
		SELECT type, SUM(count) AS total FROM reaction_counts
		WHERE subject_rowid = ${byId(id)} GROUP BY type ORDER BY total DESC`,
	// The end of the line: 'removed' hides a subject, purge deletes it. The
	// two-stage removal (§3.5) has already run, so there is nothing left to
	// reverse — and the reaction counters and any queued request go with the
	// row, by ON DELETE CASCADE. Listing first shows the operator what went.
	// Without an id, every removed subject is purged at once.
	purge: (id) => {
		const scope = id === "" ? "" : ` AND id = '${id}'`;
		return `
		SELECT id, name FROM subjects WHERE status = 'removed'${scope};
		DELETE FROM subjects
		 WHERE rowid IN (SELECT rowid FROM subjects WHERE status = 'removed'${scope})`;
	},
};

function isSubcommand(word: string | undefined): word is Subcommand {
	return (SUBCOMMANDS as readonly string[]).includes(word ?? "");
}

const subcommand = process.argv.at(2);
if (!isSubcommand(subcommand)) {
	console.error(
		`usage: bun run ops <${SUBCOMMANDS.join("|")}> [subject-id] [--env local|development|production]`,
	);
	process.exit(1);
}
const sql = STATEMENTS[subcommand](WITHOUT_ID.includes(subcommand) ? "" : subjectId());
console.table((await execute(sql)) as object[]);
