/**
 * Flat SVG badges rendered from string templates: no Satori, no fonts to
 * load, so CPU cost is effectively zero and the CDN / GitHub Camo cache the
 * result. The one badge is an identity mark — the brand segment ({icon}
 * Negirau) and the subject's name — with no count on it: an embedded number
 * would go stale in third-party caches, and the badge's job is to say "this
 * page collects appreciation here", not to score it. Language-neutral by
 * construction, so it needs no lang parameter.
 */

import { BRAND_COLORS, heartPinOutline } from "~/lib/brand";
import { escapeXml } from "~/lib/server/route-helpers";

const FONT_FAMILY = "Verdana,Geneva,DejaVu Sans,sans-serif";
const HEIGHT = 20;
const PADDING = 6;
const ICON_SIZE = 13;
const BRAND_TEXT = "Negirau";
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

const BRAND_WIDTH = PADDING + ICON_SIZE + 4 + textWidth(BRAND_TEXT) + PADDING;
const NAME_BUDGET = MAX_WIDTH - BRAND_WIDTH - 2 * PADDING;
const ICON_SCALE = ICON_SIZE / 24;

export function renderBadgeSvg(subjectName: string): string {
	const shownName = truncateToWidth(subjectName, NAME_BUDGET);
	const nameWidth = PADDING + textWidth(shownName) + PADDING;
	const total = BRAND_WIDTH + nameWidth;
	const escapedName = escapeXml(shownName);
	return `<svg xmlns="http://www.w3.org/2000/svg" width="${total}" height="${HEIGHT}" role="img" aria-label="${BRAND_TEXT}: ${escapedName}">
<title>${BRAND_TEXT}: ${escapedName}</title>
<rect width="${BRAND_WIDTH}" height="${HEIGHT}" fill="${BRAND_COLORS.accentDark}"/>
<rect x="${BRAND_WIDTH}" width="${nameWidth}" height="${HEIGHT}" fill="${BRAND_COLORS.accent}"/>
<g transform="translate(${PADDING},${(HEIGHT - ICON_SIZE) / 2}) scale(${ICON_SCALE})">
${heartPinOutline("#fff")}
</g>
<g fill="#fff" font-family="${FONT_FAMILY}" font-size="11">
<text x="${PADDING + ICON_SIZE + 4}" y="14">${BRAND_TEXT}</text>
<text x="${BRAND_WIDTH + PADDING}" y="14">${escapedName}</text>
</g>
</svg>`;
}

export function badgeResponse(svg: string): Response {
	return new Response(svg, {
		headers: {
			"content-type": "image/svg+xml; charset=utf-8",
			// The badge changes only on a rename or a takedown, both daily-review
			// events — the same staleness the OG card already accepts at these TTLs.
			"cache-control": "public, max-age=3600, s-maxage=86400",
		},
	});
}
