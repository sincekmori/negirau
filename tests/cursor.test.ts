import { describe, expect, it } from "vitest";

import { decodeCursor, encodeCursor } from "~/lib/cursor";

const SECRET = "test-secret";

describe("cursor", () => {
	it("round-trips an id", async () => {
		expect(await decodeCursor(SECRET, await encodeCursor(SECRET, 42))).toBe(42);
	});

	it("rejects garbage without throwing", async () => {
		expect(await decodeCursor(SECRET, "not-a-cursor!")).toBeUndefined();
		expect(await decodeCursor(SECRET, "")).toBeUndefined();
		expect(await decodeCursor(SECRET, btoa("-5"))).toBeUndefined();
	});

	it("keeps the rowid unreadable and unforgeable", async () => {
		const cursor = await encodeCursor(SECRET, 4242);
		// Sealed, not encoded: the id must not survive in the wire format.
		expect(cursor).not.toContain("4242");
		expect(atob(cursor.replaceAll("-", "+").replaceAll("_", "/"))).not.toContain("4242");
		// Another instance's secret cannot open ours.
		expect(await decodeCursor("other-secret", cursor)).toBeUndefined();
	});

	it("mints a distinct cursor each time for the same id", async () => {
		// A fresh IV per seal: identical pages must not produce a stable token
		// that could be recognised across clients.
		expect(await encodeCursor(SECRET, 7)).not.toBe(await encodeCursor(SECRET, 7));
	});
});
