// Integration tests for the reaction write flow against a real (miniflare) D1.

import { env } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { toIsoDate } from "~/lib/period";
import { countsSummary } from "~/lib/server/db";
import type { SubjectRow } from "~/lib/server/db";
import { handleReact, handleUndo } from "~/lib/server/react";

import { resetDb, seedSubject } from "./helpers";

// Turnstile siteverify is the only outbound fetch in this flow; stub it globally
// so tests never leave the process.
const siteverify = vi.fn<typeof fetch>();

function mockSiteverify(success: boolean): void {
	siteverify.mockResolvedValue(Response.json({ success }));
}

const deps = { env, clientIp: "203.0.113.7" };
const today = () => toIsoDate(new Date());

async function todayByType(subjectRowid: number): Promise<Record<string, number>> {
	const summary = await countsSummary(env.DB, subjectRowid, { start: today(), end: today() });
	return summary.byType;
}

let subject: SubjectRow;

beforeEach(async () => {
	siteverify.mockReset();
	vi.stubGlobal("fetch", siteverify);
	await resetDb();
	subject = await seedSubject("test library", 35.6, 139.65);
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("handleReact", () => {
	it("records a reaction and returns an undo voucher", async () => {
		mockSiteverify(true);
		const result = await handleReact(deps, subject.id, { type: "heart", token: "tok" });
		expect(result).toMatchObject({ ok: true });
		expect(await todayByType(subject.rowid)).toEqual({ heart: 1 });
	});

	it("rejects when Turnstile verification fails", async () => {
		mockSiteverify(false);
		const result = await handleReact(deps, subject.id, { type: "like", token: "bad" });
		expect(result).toMatchObject({ ok: false, status: 403 });
	});

	it("rejects unknown subjects after verification", async () => {
		mockSiteverify(true);
		const result = await handleReact(deps, "nope", { type: "like", token: "tok" });
		expect(result).toMatchObject({ ok: false, status: 404 });
	});

	it("treats quarantined subjects as unknown", async () => {
		mockSiteverify(true);
		await env.DB.prepare("UPDATE subjects SET status = 'quarantined' WHERE rowid = ?")
			.bind(subject.rowid)
			.run();
		const result = await handleReact(deps, subject.id, { type: "heart", token: "tok" });
		expect(result).toMatchObject({ ok: false, status: 404 });
		expect(await todayByType(subject.rowid)).toEqual({});
	});

	it("honors the kill switch without touching Turnstile", async () => {
		const result = await handleReact(
			{ ...deps, env: { ...env, REACTIONS_ENABLED: "false" } },
			subject.id,
			{ type: "heart", token: "tok" },
		);
		expect(result).toMatchObject({ ok: false, status: 503 });
		expect(siteverify).not.toHaveBeenCalled();
	});
});

describe("handleUndo", () => {
	it("revokes today's reaction with the issued voucher only", async () => {
		mockSiteverify(true);
		const sent = await handleReact(deps, subject.id, { type: "heart", token: "tok" });
		if (!sent.ok) {
			throw new Error("send failed");
		}
		// Wrong scope: a voucher for heart must not undo like.
		const wrongType = await handleUndo(deps, subject.id, {
			type: "like",
			undo_token: sent.undo_token,
		});
		expect(wrongType).toMatchObject({ ok: false, status: 403 });
		const undone = await handleUndo(deps, subject.id, {
			type: "heart",
			undo_token: sent.undo_token,
		});
		expect(undone.ok).toBe(true);
		expect(await todayByType(subject.rowid)).toEqual({});
	});

	it("rejects forged tokens", async () => {
		const day = new Date().toISOString().slice(0, 10);
		for (const token of [`${Date.now() + 60_000}.forged`, `${Date.now() + 60_000}.${day}.forged`]) {
			expect(
				await handleUndo(deps, subject.id, { type: "heart", undo_token: token }),
			).toMatchObject({ ok: false, status: 403 });
		}
	});

	it("undoes the day the voucher names, not the day the clock shows", async () => {
		mockSiteverify(true);
		const sent = await handleReact(deps, subject.id, { type: "heart", token: "tok" });
		if (!sent.ok) {
			throw new Error("send failed");
		}
		// The voucher carries its day, so a send that straddles UTC midnight
		// still undoes the row it incremented.
		const [, day] = sent.undo_token.split(".");
		expect(day).toBe(new Date().toISOString().slice(0, 10));
		const undone = await handleUndo(deps, subject.id, {
			type: "heart",
			undo_token: sent.undo_token,
		});
		expect(undone).toMatchObject({ ok: true, day });
	});

	it("refuses a voucher whose day was tampered with", async () => {
		mockSiteverify(true);
		const sent = await handleReact(deps, subject.id, { type: "heart", token: "tok" });
		if (!sent.ok) {
			throw new Error("send failed");
		}
		const [expires, , signature] = sent.undo_token.split(".");
		const result = await handleUndo(deps, subject.id, {
			type: "heart",
			undo_token: `${expires}.2020-01-01.${signature}`,
		});
		expect(result).toMatchObject({ ok: false, status: 403 });
		// The genuine day is untouched.
		expect(await todayByType(subject.rowid)).toEqual({ heart: 1 });
	});
});
