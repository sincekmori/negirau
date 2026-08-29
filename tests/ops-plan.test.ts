// The ops CLI decides which rows a production takedown touches, and its only
// reviewer is the operator reading a terminal. These pin the three ways that
// reading was wrong: a scoped purge that ignored its id, a missing id that a
// flag stood in for, and a review window that compared timestamps in two
// different formats.

import { describe, expect, it } from "vitest";

import { planFromArgv, UsageError } from "../scripts/ops-plan";

const ID = "0e6f9b3a-6b1e-4b8a-9a6a-1c2d3e4f5a6b";

describe("planFromArgv", () => {
	it("scopes a purge to the id it was given", () => {
		const plan = planFromArgv(["purge", ID]);
		expect(plan.id).toBe(ID);
		// Both statements must carry the scope: the DELETE without it takes
		// every removed subject, which is the whole point of naming one.
		expect(plan.sql.match(new RegExp(`AND id = '${ID}'`, "gu"))).toHaveLength(2);
	});

	it("purges every removed subject only when no id is given", () => {
		const plan = planFromArgv(["purge"]);
		expect(plan.id).toBe("");
		expect(plan.sql).not.toContain("AND id =");
	});

	it("refuses a flag where a subject id belongs", () => {
		// '--env' is letters and hyphens, so an id pattern that does not anchor
		// its first character accepts it and quarantines nothing, quietly.
		expect(() => planFromArgv(["delete", "--env", "production"])).toThrow(UsageError);
		expect(() => planFromArgv(["delete"])).toThrow(UsageError);
	});

	it("reads the id whichever side of the flag it sits on", () => {
		expect(planFromArgv(["delete", ID, "--env", "production"])).toMatchObject({
			id: ID,
			target: "production",
		});
		expect(planFromArgv(["delete", "--env", "production", ID])).toMatchObject({
			id: ID,
			target: "production",
		});
	});

	it("defaults to development, never production", () => {
		expect(planFromArgv(["counts", ID]).target).toBe("development");
	});

	it("rejects an unknown flag instead of taking it for an id", () => {
		expect(() => planFromArgv(["counts", "--dry-run", ID])).toThrow(UsageError);
		expect(() => planFromArgv(["counts", ID, "--env", "prod"])).toThrow(UsageError);
	});

	it("rejects an id for the whole-table subcommand", () => {
		expect(() => planFromArgv(["review", ID])).toThrow(UsageError);
	});

	it("rejects a subject id that could carry SQL", () => {
		expect(() => planFromArgv(["delete", "x'; DROP TABLE subjects; --"])).toThrow(UsageError);
	});

	it("compares the review window in the format created_at is stored in", () => {
		// created_at is ISO ("...T...Z"); datetime() returns a space-separated
		// string, and 'T' sorts above ' ', so that compare counts a day too many.
		const { sql } = planFromArgv(["review"]);
		expect(sql).toContain("created_at >= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-2 days')");
		expect(sql).not.toContain("created_at >= datetime(");
	});
});
