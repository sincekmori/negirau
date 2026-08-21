// Pins the hand-copied identity between the SQL seed and the TS constant the
// e2e/a11y suites use — a mismatched UUID would otherwise surface as an
// opaque e2e 404.

import { describe, expect, it } from "vitest";

import devSeed from "../scripts/seed/dev-seed.sql?raw";
import { SEED_SUBJECT } from "../scripts/seed/seed-subject";

describe("dev seed", () => {
	it("creates the subject the test suites reference", () => {
		expect(devSeed).toContain(`'${SEED_SUBJECT.id}'`);
		expect(devSeed).toContain(SEED_SUBJECT.name);
	});
});
