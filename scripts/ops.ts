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
 *
 * Which subject and which SQL is decided in ops-plan.ts, where it is tested;
 * this file only runs the result.
 */

import { unstable_readConfig } from "wrangler";

import { planFromArgv, UsageError } from "./ops-plan";
import type { Target } from "./ops-plan";

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
const TARGET_FLAGS: Record<Target, { db: string; flags: readonly string[] }> = {
	local: { db: rootDb, flags: ["--local"] },
	development: { db: databaseName("dev"), flags: ["--env", "dev", "--remote"] },
	production: { db: rootDb, flags: ["--remote"] },
};

async function execute(sql: string, target: Target): Promise<unknown> {
	const { db, flags } = TARGET_FLAGS[target];
	const proc = Bun.spawn(
		// Remote writes prompt for confirmation; this runs non-interactively, and
		// the deliberate act is already the explicit `--env production`.
		["bunx", "wrangler", "d1", "execute", db, ...flags, "--json", "--yes", "--command", sql],
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

let plan;
try {
	plan = planFromArgv(process.argv.slice(2));
} catch (error) {
	console.error(error instanceof UsageError ? error.message : String(error));
	process.exit(1);
}
console.table((await execute(plan.sql, plan.target)) as object[]);
