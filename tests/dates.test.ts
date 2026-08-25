import { describe, expect, it } from "vitest";

import { isoWeekId, toIsoDate } from "~/lib/dates";

describe("isoWeekId", () => {
	it("assigns early January to the previous year's last week when ISO rules say so", () => {
		expect(isoWeekId(new Date("2027-01-01"))).toBe("2026-W53");
	});

	it("computes a mid-year week", () => {
		expect(isoWeekId(new Date("2026-08-14"))).toBe("2026-W33");
	});
});

describe("toIsoDate", () => {
	it("keys a timestamp by its UTC day", () => {
		expect(toIsoDate(new Date("2026-08-14T23:59:59+09:00"))).toBe("2026-08-14");
	});
});
