import { describe, expect, it } from "vitest";

import { isoWeekId, monthRange, parseIsoWeek, weekRange } from "~/lib/period";

describe("isoWeekId", () => {
	it("assigns early January to the previous year's last week when ISO rules say so", () => {
		expect(isoWeekId(new Date("2027-01-01"))).toBe("2026-W53");
	});

	it("computes a mid-year week", () => {
		expect(isoWeekId(new Date("2026-08-14"))).toBe("2026-W33");
	});
});

describe("weekRange", () => {
	it("spans Monday through Sunday around a Friday", () => {
		expect(weekRange(new Date("2026-08-14"))).toEqual({ start: "2026-08-10", end: "2026-08-16" });
	});

	it("treats Monday as its own week start", () => {
		expect(weekRange(new Date("2026-08-10"))).toEqual({ start: "2026-08-10", end: "2026-08-16" });
	});
});

describe("monthRange", () => {
	it("covers the full month including leap days", () => {
		expect(monthRange(new Date("2028-02-10"))).toEqual({ start: "2028-02-01", end: "2028-02-29" });
	});
});

describe("parseIsoWeek", () => {
	it("round-trips with isoWeekId", () => {
		const range = parseIsoWeek("2026-W33");
		expect(range).toEqual({ start: "2026-08-10", end: "2026-08-16" });
	});

	it("rejects a W53 that does not exist in that year", () => {
		expect(parseIsoWeek("2025-W53")).toBeUndefined();
	});

	it("rejects malformed input", () => {
		expect(parseIsoWeek("2026-33")).toBeUndefined();
		expect(parseIsoWeek("garbage")).toBeUndefined();
	});
});
