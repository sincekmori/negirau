/**
 * What an ops invocation would do, decided without touching anything: which
 * target, which subject, which SQL. Split from ops.ts so the argument parsing
 * that stands between a typo and a production takedown is unit-testable — the
 * wrangler subprocess around it is not.
 */

import { isoCutoffSql, ROLLUP_WATCH_THRESHOLD } from "../app/lib/server/db";

const SUBCOMMANDS = [
	"review",
	"apply",
	"delete",
	"finalize",
	"restore",
	"counts",
	"purge",
] as const;
type Subcommand = (typeof SUBCOMMANDS)[number];

const TARGETS = ["local", "development", "production"] as const;
export type Target = (typeof TARGETS)[number];

/**
 * Subject ids are UUIDs or operator slugs. Anchoring the first character on
 * [A-Za-z0-9] is what keeps a flag out: '--env' is only hyphens and letters, so
 * a bare [A-Za-z0-9-]+ accepts it as an id and runs the statement against a
 * subject that cannot exist — reporting success for a takedown that never ran.
 */
const SUBJECT_ID = /^[A-Za-z0-9][A-Za-z0-9-]*$/u;

export interface OpsPlan {
	target: Target;
	/** The subject the statement is scoped to; "" means the whole-table form. */
	id: string;
	sql: string;
}

export class UsageError extends Error {
	public override readonly name = "UsageError";
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
		 WHERE created_at >= ${isoCutoffSql("-2 days")}
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
	// two-stage removal has already run, so there is nothing left to reverse —
	// and the reaction counters and any queued request go with the row, by
	// ON DELETE CASCADE. Listing first shows the operator what went.
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

function isTarget(word: string): word is Target {
	return (TARGETS as readonly string[]).includes(word);
}

/**
 * Positional words and the --env value, separated. Unknown flags are rejected
 * rather than collected: a mistyped flag must not slide into the id slot.
 */
function split(argv: readonly string[]): { positionals: string[]; target: Target } {
	const positionals: string[] = [];
	let target: Target = "development";
	for (let index = 0; index < argv.length; index += 1) {
		const word = argv[index] ?? "";
		if (word === "--env") {
			const value = argv[index + 1];
			if (value === undefined || !isTarget(value)) {
				throw new UsageError(`--env takes one of: ${TARGETS.join(" | ")}`);
			}
			target = value;
			index += 1;
			continue;
		}
		if (word.startsWith("-")) {
			throw new UsageError(`unknown flag: ${word}`);
		}
		positionals.push(word);
	}
	return { positionals, target };
}

const USAGE = `usage: bun run ops <${SUBCOMMANDS.join("|")}> [subject-id] [--env ${TARGETS.join("|")}]`;

/**
 * review acts on the whole table; purge scopes to an id when given one, to
 * every removed row without; everything else needs its subject. "" is the
 * whole-table form.
 */
function validatedId(subcommand: Subcommand, given: string | undefined): string {
	if (subcommand === "review" && given !== undefined) {
		throw new UsageError("review acts on the whole table and takes no subject id");
	}
	if (given === undefined) {
		if (subcommand !== "review" && subcommand !== "purge") {
			throw new UsageError(`${subcommand} needs a subject id`);
		}
		return "";
	}
	if (!SUBJECT_ID.test(given)) {
		throw new UsageError(`not a subject id: ${given}`);
	}
	return given;
}

export function planFromArgv(argv: readonly string[]): OpsPlan {
	const { positionals, target } = split(argv);
	const [subcommand, given, ...extra] = positionals;
	if (!isSubcommand(subcommand)) {
		throw new UsageError(USAGE);
	}
	if (extra.length > 0) {
		throw new UsageError(`unexpected argument: ${extra[0] ?? ""}`);
	}
	const id = validatedId(subcommand, given);
	return { target, id, sql: STATEMENTS[subcommand](id) };
}
