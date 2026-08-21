// GET /sitemap.xml — a sitemap index over id-block pages (/sitemaps/{n}.xml).
// One max(id) read here; each page reads only its own block.

import { appContext } from "~/lib/context";
import { maxSubjectRowid } from "~/lib/server/db";
import { edgeCachedByUrl } from "~/lib/server/edge-cache";
import { escapeXml } from "~/lib/server/route-helpers";
import { SITEMAP_BLOCK_SIZE, xmlResponse } from "~/lib/server/sitemap";

import type { Route } from "./+types/sitemap";

export function loader(args: Route.LoaderArgs) {
	// Read-only representation: served through the edge cache (URL-keyed).
	const { ctx } = args.context.get(appContext);
	return edgeCachedByUrl(args.request, ctx, () => Promise.resolve(produce(args)));
}

async function produce({ context }: Route.LoaderArgs) {
	const { env, site } = context.get(appContext);
	const maxRowid = await maxSubjectRowid(env.DB);
	const pages = Math.max(1, Math.ceil((maxRowid + 1) / SITEMAP_BLOCK_SIZE));
	const entries = Array.from(
		{ length: pages },
		(_, page) => `<sitemap><loc>${escapeXml(`${site.canonical}/sitemaps/${page}`)}</loc></sitemap>`,
	).join("");
	return xmlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries}</sitemapindex>
`);
}
