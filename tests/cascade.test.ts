// Deleting a subject for real must take its rows with it (migration 0002).
// Without the cascade a purge would depend on the operator remembering every
// child table, and a forgotten row would not stay harmless: SQLite reuses a
// freed rowid, so the next subject to take that slot would inherit the
// leftovers as its own reactions.

import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";

import { recordReaction } from "~/lib/server/db";

import { resetDb, seedSubject } from "./helpers";

beforeEach(async () => {
	await resetDb();
});

async function countIn(table: string, rowid: number): Promise<number> {
	const row = await env.DB.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE subject_rowid = ?`)
		.bind(rowid)
		.first<{ n: number }>();
	return row?.n ?? 0;
}

describe("deleting a subject", () => {
	it("takes its reaction counters and queued requests with it", async () => {
		const subject = await seedSubject("purge me");
		await recordReaction(env.DB, subject.rowid, "heart", "2026-08-22");
		await env.DB.prepare(
			`INSERT INTO subject_requests (subject_rowid, kind, payload, created_at)
			 VALUES (?, 'delete', NULL, '2026-08-22T00:00:00Z')`,
		)
			.bind(subject.rowid)
			.run();
		expect(await countIn("reaction_counts", subject.rowid)).toBe(1);
		expect(await countIn("subject_requests", subject.rowid)).toBe(1);

		await env.DB.prepare("DELETE FROM subjects WHERE rowid = ?").bind(subject.rowid).run();

		expect(await countIn("reaction_counts", subject.rowid)).toBe(0);
		expect(await countIn("subject_requests", subject.rowid)).toBe(0);
	});

	it("leaves other subjects untouched", async () => {
		const doomed = await seedSubject("doomed");
		const kept = await seedSubject("kept");
		await recordReaction(env.DB, doomed.rowid, "heart", "2026-08-22");
		await recordReaction(env.DB, kept.rowid, "heart", "2026-08-22");

		await env.DB.prepare("DELETE FROM subjects WHERE rowid = ?").bind(doomed.rowid).run();

		expect(await countIn("reaction_counts", kept.rowid)).toBe(1);
	});
});
