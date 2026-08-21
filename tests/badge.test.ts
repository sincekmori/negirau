import { describe, expect, it } from "vitest";

import { BRAND_COLORS } from "~/lib/brand";
import { renderBadgeSvg } from "~/lib/server/badge";

describe("renderBadgeSvg", () => {
	it("renders the subject name and value", () => {
		const svg = renderBadgeSvg("世田谷消防署", "13/週");
		expect(svg).toContain(">世田谷消防署<");
		expect(svg).toContain(">13/週<");
		expect(svg).toContain('aria-label="世田谷消防署: 13/週"');
	});

	it("escapes markup in name and value", () => {
		expect(renderBadgeSvg("<x>&", '"y"')).not.toContain("<x>");
	});

	it("widens with longer values", () => {
		expect(badgeWidth("subject", "100+/wk")).toBeGreaterThan(badgeWidth("subject", "0"));
	});

	it("truncates a long name so the badge never exceeds the width budget", () => {
		const svg = renderBadgeSvg("と".repeat(60), "100+");
		expect(badgeWidthOf(svg)).toBeLessThanOrEqual(360);
		expect(svg).toContain("…");
	});

	it("brand-fills every badge", () => {
		expect(renderBadgeSvg("x", "100+")).toContain(BRAND_COLORS.accentDark);
		expect(renderBadgeSvg("x", "3")).toContain(BRAND_COLORS.accent);
	});
});

function badgeWidthOf(svg: string): number {
	return Number(/width="(?<width>\d+)"/.exec(svg)?.groups?.["width"]);
}

function badgeWidth(label: string, value: string): number {
	return badgeWidthOf(renderBadgeSvg(label, value));
}
