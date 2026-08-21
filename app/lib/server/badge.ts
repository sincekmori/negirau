/**
 * Flat SVG badges rendered from string templates: no Satori, no fonts to
 * load, so CPU cost is effectively zero and the CDN / GitHub Camo cache the
 * result. The one badge shows the subject's name and the period's display
 * value in the brand colors, truncated so it stays on one line even on a
 * small phone screen.
 */

import { BRAND_COLORS, heartPinOutline } from "~/lib/brand";
import { escapeXml } from "~/lib/server/route-helpers";

const FONT_FAMILY = "Verdana,Geneva,DejaVu Sans,sans-serif";
const HEIGHT = 20;
const PADDING = 6;
const ICON_SIZE = 13;
/** Total width budget: fits an iPhone SE class viewport (375px) with margins. */
const MAX_WIDTH = 360;
const ELLIPSIS = "…";

/** Approximate 11px advance: ASCII is narrow, CJK and emoji are square-ish. */
function textWidth(text: string): number {
	let width = 0;
	for (const ch of text) {
		width += (ch.codePointAt(0) ?? 0) > 255 ? 12 : 7;
	}
	return width;
}

const ELLIPSIS_WIDTH = textWidth(ELLIPSIS);

/** Longest prefix of `text` (plus an ellipsis when cut) within `budget` px. */
function truncateToWidth(text: string, budget: number): string {
	if (textWidth(text) <= budget) {
		return text;
	}
	let kept = "";
	let width = 0;
	for (const ch of text) {
		const advance = textWidth(ch);
		if (width + advance + ELLIPSIS_WIDTH > budget) {
			break;
		}
		kept += ch;
		width += advance;
	}
	return `${kept}${ELLIPSIS}`;
}

export function renderBadgeSvg(label: string, value: string): string {
	const valueWidth = PADDING + textWidth(value) + PADDING;
	const labelBudget = MAX_WIDTH - valueWidth - (PADDING + ICON_SIZE + 4 + PADDING);
	const shownLabel = truncateToWidth(label, labelBudget);
	const labelWidth = PADDING + ICON_SIZE + 4 + textWidth(shownLabel) + PADDING;
	const total = labelWidth + valueWidth;
	const iconScale = ICON_SIZE / 24;
	const escapedLabel = escapeXml(shownLabel);
	const escapedValue = escapeXml(value);
	return `<svg xmlns="http://www.w3.org/2000/svg" width="${total}" height="${HEIGHT}" role="img" aria-label="${escapedLabel}: ${escapedValue}">
<title>${escapedLabel}: ${escapedValue}</title>
<rect width="${labelWidth}" height="${HEIGHT}" fill="${BRAND_COLORS.accentDark}"/>
<rect x="${labelWidth}" width="${valueWidth}" height="${HEIGHT}" fill="${BRAND_COLORS.accent}"/>
<g transform="translate(${PADDING},${(HEIGHT - ICON_SIZE) / 2}) scale(${iconScale})">
${heartPinOutline("#fff")}
</g>
<g fill="#fff" font-family="${FONT_FAMILY}" font-size="11">
<text x="${PADDING + ICON_SIZE + 4}" y="14">${escapedLabel}</text>
<text x="${labelWidth + PADDING}" y="14">${escapedValue}</text>
</g>
</svg>`;
}

export function badgeResponse(svg: string): Response {
	return new Response(svg, {
		headers: {
			"content-type": "image/svg+xml; charset=utf-8",
			"cache-control": "public, max-age=300, s-maxage=3600",
		},
	});
}
