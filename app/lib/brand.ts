/**
 * Brand constants for the imperative renderers (OG template, badge SVG,
 * poster sheet). The outline icon lives in BrandIcon.tsx; the favicon is a static
 * asset. Web page styling uses these same values in component CSS.
 */

/** Heart-pin outline stroke — BrandIcon and the hero draw the same mark. */
export const HEART_PIN_OUTLINE_PATH =
	"M12 22c-1-3.4-7.8-8.2-7.8-13.2C4.2 6 6.3 3.8 9 3.8c1.2 0 2.3.6 3 1.5.7-.9 1.8-1.5 3-1.5 2.7 0 4.8 2.2 4.8 5C19.8 13.8 13 18.6 12 22Z";

/** Center dot of the outline pin (stroked), in the same 24×24 space. */
export const HEART_PIN_DOT = { cx: 12, cy: 9.8, r: 2.2 };

/**
 * The one official mark, as SVG elements in the 24×24 design space, for the
 * imperative renderers (badge, OG card, QR emblem). BrandIcon is the JSX
 * twin; both read the same geometry above.
 */
export function heartPinOutline(stroke: string): string {
	const strokeAttrs = `fill="none" stroke="${stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"`;
	return (
		`<path d="${HEART_PIN_OUTLINE_PATH}" ${strokeAttrs}/>` +
		`<circle cx="${HEART_PIN_DOT.cx}" cy="${HEART_PIN_DOT.cy}" r="${HEART_PIN_DOT.r}" ${strokeAttrs}/>`
	);
}

export const BRAND_COLORS = {
	accent: "#e0526f",
	accentDark: "#b8405e",
	background: "#fff8f4",
	ink: "#3c2f2f",
	muted: "#8a7a74",
} as const;

/**
 * Bumped whenever the OG card template changes. It rides both the internal
 * edge-cache key and the og:image URLs' ?v= query, so a bump invalidates the
 * Cloudflare HTTP cache and third-party preview caches (LINE, Slack, X) in
 * one move — those cache per image URL and never revalidate promptly.
 */
export const OG_TEMPLATE_VERSION = 4;
