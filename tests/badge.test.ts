import { describe, expect, it } from "vitest";

import { BRAND_COLORS } from "~/lib/brand";
import { renderBadgeSvg } from "~/lib/server/badge";

describe("renderBadgeSvg", () => {
	it("renders the brand segment and the subject name", () => {
		const svg = renderBadgeSvg("Setagaya Central Library");
		expect(svg).toContain(">Negirau<");
		expect(svg).toContain(">Setagaya Central Library<");
		expect(svg).toContain('aria-label="Negirau: Setagaya Central Library"');
	});

	it("shows no count in any visible text", () => {
		// The identity badge deliberately shows no number: an embedded count
		// would go stale in third-party caches — that is the redesign's point.
		const svg = renderBadgeSvg("library");
		const visibleText = [...svg.matchAll(/>(?<text>[^<>]+)</gu)].map((m) => m.groups?.["text"]);
		expect(visibleText.length).toBeGreaterThan(0);
		for (const text of visibleText) {
			expect(text).not.toMatch(/\d/u);
		}
	});

	it("escapes markup in the name", () => {
		expect(renderBadgeSvg("<x>&")).not.toContain("<x>");
	});

	it("grows with the name", () => {
		expect(badgeWidth("a much longer subject name")).toBeGreaterThan(badgeWidth("a"));
	});

	it("truncates a long name so the badge never exceeds the width budget", () => {
		const svg = renderBadgeSvg("と".repeat(60));
		expect(badgeWidthOf(svg)).toBeLessThanOrEqual(360);
		expect(svg).toContain("…");
	});

	it("brand-fills every badge", () => {
		const svg = renderBadgeSvg("x");
		expect(svg).toContain(BRAND_COLORS.accentDark);
		expect(svg).toContain(BRAND_COLORS.accent);
	});
});

function badgeWidthOf(svg: string): number {
	return Number(/width="(?<width>\d+)"/.exec(svg)?.groups?.["width"]);
}

function badgeWidth(name: string): number {
	return badgeWidthOf(renderBadgeSvg(name));
}
