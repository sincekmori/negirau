/**
 * Sitemap building blocks, shared by the index route (/sitemap.xml) and the
 * page routes (/sitemaps/{n}.xml). Split by subject-id blocks: the sitemap
 * spec caps one file at 50k URLs / 50 MB, and a nationwide corpus blows both
 * in a single file (measured 162 MB at 250k subjects).
 */

import { LOCALES } from "~/lib/i18n/messages";
import { cachedResponse, escapeXml } from "~/lib/server/route-helpers";

/** Subject rowids per sitemap page: ×2 locales stays well under the 50k-URL cap. */
export const SITEMAP_BLOCK_SIZE = 20_000;

/** One <url> per locale variant, each carrying the full alternate set. */
export function urlEntries(canonicalOrigin: string, barePath: string): string {
	const alternates = [
		...LOCALES.map(
			(locale) =>
				`<xhtml:link rel="alternate" hreflang="${locale}" href="${escapeXml(`${canonicalOrigin}/${locale}${barePath}`)}"/>`,
		),
		`<xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(`${canonicalOrigin}${barePath || "/"}`)}"/>`,
	].join("");
	return LOCALES.map(
		(locale) =>
			`<url><loc>${escapeXml(`${canonicalOrigin}/${locale}${barePath}`)}</loc>${alternates}</url>`,
	).join("");
}

export function urlsetResponse(entries: string): Response {
	const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${entries}</urlset>
`;
	return xmlResponse(body);
}

export function xmlResponse(body: string): Response {
	return cachedResponse(body, "application/xml; charset=utf-8", 3600);
}
