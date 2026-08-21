// Drift pins in the spirit of versions.test.ts: the reaction ids are frozen
// wire/DB values, and the static favicon must keep matching the brand source.
import { describe, expect, it } from "vitest";

import faviconSvg from "../app/lib/assets/favicon.svg?raw";
import { BRAND_COLORS, HEART_PIN_DOT, HEART_PIN_OUTLINE_PATH } from "../app/lib/brand";
import { REACTION_TYPES } from "../app/lib/reactions";

describe("reaction ids", () => {
	it("stay frozen — renaming one orphans every stored reaction_counts row", () => {
		expect(REACTION_TYPES).toEqual(["heart", "like", "handshake", "blossom", "tea"]);
	});
});

describe("favicon", () => {
	it("carries the brand heart-pin outline and accent color", () => {
		expect(faviconSvg).toContain(HEART_PIN_OUTLINE_PATH);
		expect(faviconSvg).toContain(BRAND_COLORS.accent);
		expect(faviconSvg).toContain(`r="${HEART_PIN_DOT.r}"`);
		// The stroke treatment must match heartPinOutline's.
		expect(faviconSvg).toContain('stroke-width="2"');
		expect(faviconSvg).toContain('stroke-linecap="round"');
	});
});
