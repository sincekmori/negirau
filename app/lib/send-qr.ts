// The send QR in one place: the URL shape, the encoder options, and the
// center brand emblem are a shared invariant of the subject page and the
// poster — every send QR changes together.
import { renderSVG } from "uqr";

import { BRAND_COLORS, heartPinOutline } from "~/lib/brand";
import type { ReactionType } from "~/lib/reactions";

/**
 * Width of the center emblem as a fraction of the whole code. Its white
 * backing disc covers ~6% of the module area — well inside the 25% the
 * Q error-correction level can reconstruct.
 */
const EMBLEM_FRACTION = 0.22;

/**
 * SVG for a QR that opens the bare subject URL and auto-sends `type`, with
 * the heart-pin emblem in the center (the usual branded-QR treatment).
 * Error correction Q because the emblem deliberately destroys modules; Q
 * over H keeps the module grid coarse enough that the small business-card
 * poster cell and an on-screen code stay scannable from another phone.
 */
export function sendQrSvg(origin: string, subjectId: string, type: ReactionType): string {
	const pixelSize = 10;
	let modules = 0;
	const svg = renderSVG(`${origin}/subjects/${subjectId}?send=${type}`, {
		ecc: "Q",
		border: 2,
		pixelSize,
		// The rendered viewBox is exactly size × pixelSize; the callback hands
		// us the size first-hand instead of scraping the SVG string.
		onEncoded: (qr) => {
			modules = qr.size;
		},
	});
	const size = modules * pixelSize;
	const center = size / 2;
	const emblem = size * EMBLEM_FRACTION;
	// Disc radius 15% past the emblem's half-width: the pin never reaches its
	// 24×24 box corners, so this clears every stroke with quiet margin.
	const backing = (emblem / 2) * 1.15;
	// The pin's 24×24 design units scaled into the emblem box.
	const scale = emblem / 24;
	const corner = center - emblem / 2;
	const overlay = `<circle cx="${center}" cy="${center}" r="${backing}" fill="white"/><g transform="translate(${corner} ${corner}) scale(${scale})">${heartPinOutline(BRAND_COLORS.accent)}</g>`;
	return svg.replace("</svg>", `${overlay}</svg>`);
}
