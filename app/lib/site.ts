/**
 * Site origins derived from the one configured domain (wrangler.jsonc
 * vars.SITE_DOMAIN): pages at https://{domain}, the API at
 * https://api.{domain}. The derivation goes through URL objects — hostname
 * surgery, not string concatenation — so ports and IDNs survive intact.
 */

export interface SiteOrigins {
	/** Page origin, e.g. "https://negirau.com". */
	canonical: string;
	/** API origin, e.g. "https://api.negirau.com". */
	api: string;
	/** Bare site host for watermarks and prose, e.g. "negirau.com". */
	host: string;
}

export function siteOrigins(domain: string): SiteOrigins {
	const canonical = new URL(`https://${domain}`);
	const api = new URL(canonical);
	api.hostname = `api.${canonical.hostname}`;
	return { canonical: canonical.origin, api: api.origin, host: canonical.host };
}
