import { describe, expect, it } from "vitest";

import { hasSent, withoutSent, withSent } from "~/lib/server/sent-cookie";

const DAY = "2026-08-15";

describe("sent cookie", () => {
	it("records, detects, and releases a send per subject, type, and day", () => {
		const value = withSent(undefined, "a/b", "heart", DAY);
		expect(hasSent(value, "a/b", "heart", DAY)).toBe(true);
		expect(hasSent(value, "a/b", "like", DAY)).toBe(false);
		expect(hasSent(value, "a/b", "heart", "2026-08-16")).toBe(false);
		expect(hasSent(withoutSent(value, "a/b", "heart", DAY), "a/b", "heart", DAY)).toBe(false);
	});

	it("keeps only the newest entries", () => {
		let value: string | undefined;
		for (let i = 0; i < 25; i += 1) {
			value = withSent(value, `s${i}`, "heart", DAY);
		}
		expect(hasSent(value, "s0", "heart", DAY)).toBe(false);
		expect(hasSent(value, "s24", "heart", DAY)).toBe(true);
	});

	it("re-adding an entry does not duplicate it", () => {
		const value = withSent(withSent(undefined, "a", "heart", DAY), "a", "heart", DAY);
		expect(value).toBe(`a:heart@${DAY}`);
	});
});
