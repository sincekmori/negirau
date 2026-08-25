// Query-layer tests against a real (miniflare) D1.

import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";

import {
	countsSummary,
	getActiveSubject,
	listSubjects,
	listSubjectsBefore,
	listSubjectsByNamePrefix,
	listSubjectsNear,
	recordReaction,
} from "~/lib/server/db";

import { resetDb, seedSubject } from "./helpers";

beforeEach(async () => {
	await resetDb();
});

describe("listSubjects", () => {
	it("paginates by keyset without skipping rows", async () => {
		for (const name of ["a", "b", "c"]) {
			await seedSubject(name);
		}
		const firstPage = await listSubjects(env.DB, { limit: 2 });
		expect(firstPage.map((s) => s.name)).toEqual(["a", "b"]);
		const lastSeen = firstPage.at(-1);
		const secondPage = await listSubjects(env.DB, { limit: 2, afterRowid: lastSeen?.rowid });
		expect(secondPage.map((s) => s.name)).toEqual(["c"]);
	});

	it("matches Japanese and English name substrings via the FTS index", async () => {
		await seedSubject("世田谷消防署");
		await seedSubject("tokyo tower");
		const ja = await listSubjects(env.DB, { q: "消防署", limit: 10 });
		expect(ja.map((s) => s.name)).toEqual(["世田谷消防署"]);
		const partial = await listSubjects(env.DB, { q: "tower", limit: 10 });
		expect(partial.map((s) => s.name)).toEqual(["tokyo tower"]);
		// Below the trigram width, the route switches to the bounded prefix seek.
		const prefix = await listSubjectsByNamePrefix(env.DB, "世田", 10);
		expect(prefix.map((s) => s.name)).toEqual(["世田谷消防署"]);
		const oneChar = await listSubjectsByNamePrefix(env.DB, "世", 10);
		expect(oneChar.map((s) => s.name)).toEqual(["世田谷消防署"]);
		// Prefix means prefix: a mid-name fragment needs 3+ characters.
		expect(await listSubjectsByNamePrefix(env.DB, "消防", 10)).toEqual([]);
		// FTS query syntax is data, not operators.
		expect(await listSubjects(env.DB, { q: 'AND "x" OR', limit: 10 })).toEqual([]);
	});
});

describe("listSubjectsNear", () => {
	it("orders by distance and respects the radius", async () => {
		await seedSubject("near", 35.6, 139.65);
		await seedSubject("far", 35.7, 139.65); // ~11 km north
		await seedSubject("no-coords");
		const hits = await listSubjectsNear(env.DB, 35.601, 139.65, 5000, 10);
		expect(hits.map((s) => s.name)).toEqual(["near"]);
		expect(hits[0]?.distance_m).toBeLessThan(200);
	});
});

describe("reaction counters", () => {
	it("sums all days by type", async () => {
		const subject = await seedSubject("counted", 35.6, 139.65);
		await recordReaction(env.DB, subject.rowid, "heart", "2026-08-10");
		await recordReaction(env.DB, subject.rowid, "heart", "2026-08-10");
		await recordReaction(env.DB, subject.rowid, "like", "2026-07-01");
		expect(await countsSummary(env.DB, subject.rowid)).toEqual({
			total: 3,
			byType: { heart: 2, like: 1 },
		});
	});
});

describe("unlisted subjects", () => {
	it("resolve by id but stay out of every enumeration surface", async () => {
		const unlisted = await seedSubject("裏方チーム", 35.65, 139.65, false);
		expect(await getActiveSubject(env.DB, unlisted.id)).toBeDefined();
		const searched = await listSubjects(env.DB, { q: "裏方チーム", limit: 10 });
		expect(searched).toHaveLength(0);
		const prefixSearched = await listSubjectsByNamePrefix(env.DB, "裏方", 10);
		expect(prefixSearched).toHaveLength(0);
		const recent = await listSubjectsBefore(env.DB, undefined, 10);
		expect(recent.map((row) => row.id)).not.toContain(unlisted.id);
		const near = await listSubjectsNear(env.DB, 35.65, 139.65, 5000, 10);
		expect(near.map((row) => row.id)).not.toContain(unlisted.id);
	});
});
