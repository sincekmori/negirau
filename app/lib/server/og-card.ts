/**
 * The OG card renderer, shared by the subject cards (/subjects/{id}/og) and
 * the site card (/og/site). Cache key = (id, headline): no regeneration until
 * the display value itself moves, which keeps Satori's CPU cost off the hot
 * path.
 */

import { createElement } from "react";
import type { ReactNode } from "react";

import { BRAND_COLORS, OG_TEMPLATE_VERSION, heartPinOutline } from "~/lib/brand";
import { edgeCache } from "~/lib/server/edge-cache";

const WIDTH = 1200;
const HEIGHT = 630;

/**
 * Fetch a Noto Sans JP subset containing exactly the glyphs we render.
 * The legacy User-Agent makes Google Fonts serve TTF (Satori cannot read woff2),
 * and &text= keeps the CJK font tiny.
 */
async function loadFontSubset(text: string): Promise<ArrayBuffer> {
	const cssUrl = `https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@700&text=${encodeURIComponent(text)}`;
	const cssResponse = await fetch(cssUrl, {
		headers: { "user-agent": "Mozilla/5.0 (Windows NT 5.1)" },
	});
	const css = await cssResponse.text();
	const match = /url\((?<url>https:[^)]+)\)\s*format\(['"](?:truetype|opentype)['"]\)/.exec(css);
	const fontUrl = match?.groups?.["url"];
	if (fontUrl === undefined) {
		throw new Error("no ttf url in google fonts css");
	}
	const fontResponse = await fetch(fontUrl);
	return fontResponse.arrayBuffer();
}

function line(text: string, style: Record<string, unknown>): ReactNode {
	// display:flex on every text box: satori requires it on any node with children.
	return createElement("div", { style: { display: "flex", ...style } }, text);
}

/**
 * The card as an element tree, not an HTML string. ImageResponse parses a
 * string with HTMLRewriter, which would make a subject name containing "<"
 * reopen the parser mid-template — and escaping is not the way out, because
 * satori renders entities literally ("&amp;" would appear on the card). As
 * elements, the name is a text child that is never parsed at all.
 *
 * Satori quirks, verified against real renders: percentage sizes on the root
 * collapse to content width (use canvas pixels), and inline <svg> children are
 * dropped entirely (embed the pin as an <img> with a data: URI instead).
 */
function template(name: string, headline: string, siteHost: string): ReactNode {
	const pin = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">${heartPinOutline(BRAND_COLORS.accent)}</svg>`;
	return createElement(
		"div",
		{
			style: {
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				justifyContent: "center",
				width: WIDTH,
				height: HEIGHT,
				background: BRAND_COLORS.background,
				fontFamily: "NotoSansJP",
			},
		},
		createElement("img", {
			width: 140,
			height: 140,
			src: `data:image/svg+xml,${encodeURIComponent(pin)}`,
		}),
		line(name, { fontSize: 56, color: BRAND_COLORS.ink, marginTop: 24, maxWidth: 1080 }),
		line(headline, { fontSize: 40, color: BRAND_COLORS.accentDark, marginTop: 16 }),
		line(siteHost, { fontSize: 30, color: BRAND_COLORS.muted, marginTop: 40 }),
	);
}

export async function ogCardResponse(
	ctx: ExecutionContext,
	cacheId: string,
	name: string,
	headline: string,
	siteHost: string,
): Promise<Response> {
	const cache = edgeCache();
	// Synthetic cache key: the URL never leaves the process, it only encodes
	// (id, name, headline) — .invalid is reserved (RFC 2606), so it collides
	// with nothing. The name is part of the key because an operator applying a
	// rename usually leaves the headline untouched, and a card showing the old
	// name would otherwise be served for the rest of its 24h lifetime. An operator-set subject id "site" cannot collide with the site
	// card either: only /og/site passes an empty headline, and a subject
	// headline is never empty (weeklyHeadline always returns a sentence).
	const cacheKey = new Request(
		`https://og-cache.invalid/${encodeURIComponent(cacheId)}?n=${encodeURIComponent(name)}&b=${encodeURIComponent(headline)}&v=${OG_TEMPLATE_VERSION}`,
	);
	const cached = await cache.match(cacheKey);
	if (cached) {
		return cached;
	}

	const text = `${name}${headline}${siteHost}`;
	const font = await loadFontSubset(text);
	// Dynamic import keeps workers-og (and its wasm) off the critical path;
	// the Cloudflare vite plugin resolves the .wasm modules in the ssr environment.
	const { ImageResponse } = await import("workers-og");
	const image = new ImageResponse(template(name, headline, siteHost), {
		width: WIDTH,
		height: HEIGHT,
		fonts: [{ name: "NotoSansJP", data: font, weight: 700, style: "normal" }],
	});
	const body = await image.arrayBuffer();
	const response = new Response(body, {
		headers: {
			"content-type": "image/png",
			"cache-control": "public, max-age=3600, s-maxage=86400",
		},
	});
	ctx.waitUntil(cache.put(cacheKey, response.clone()));
	return response;
}
