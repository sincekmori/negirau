/**
 * Site identity for the build-time generators (openapi.json, llms.txt, the
 * agent skill). The one configured value lives in wrangler.jsonc
 * `vars.SITE_DOMAIN` — the file a self-hosting fork edits anyway — and both
 * this module and the Worker derive every origin from it through
 * app/lib/site.ts, so nothing is defined twice.
 */

import { unstable_readConfig } from "wrangler";

import { ROUTE_PREFIX } from "../app/lib/api/manifest";
import { siteOrigins } from "../app/lib/site";

const { vars } = unstable_readConfig({ config: "wrangler.jsonc" });
const domain = vars["SITE_DOMAIN"];
if (typeof domain !== "string" || domain === "") {
	throw new Error("wrangler.jsonc vars.SITE_DOMAIN must be a non-empty string");
}

const site = siteOrigins(domain);

export const CANONICAL_ORIGIN = site.canonical;

/** The public API base URL, as published in openapi.json `servers`. */
export const SERVER_URL = `${site.api}${ROUTE_PREFIX}`;

/** The bare site host, for prose ("negirau.com") and watermarks. */
export const SITE_HOST = site.host;
