// GET /sitemaps/:page — subject URLs for one rowid block; page 0 also
// carries the home page. Ordered by rowid, so entries never move between
// pages.

import { appContext } from "~/lib/context";
import { listActiveIdsInRowidRange } from "~/lib/server/db";
import { edgeCachedLoader } from "~/lib/server/edge-cache";
import { SITEMAP_BLOCK_SIZE, urlEntries, urlsetResponse } from "~/lib/server/sitemap";

import type { Route } from "./+types/sitemaps";

export const loader = edgeCachedLoader(produce);

async function produce({ params, context }: Route.LoaderArgs) {
	const { env, site } = context.get(appContext);
	const page = Number(params.page);
	if (!/^\d+$/.test(params.page) || !Number.isSafeInteger(page)) {
		throw new Response("not found", { status: 404 });
	}
	const startRowid = page * SITEMAP_BLOCK_SIZE;
	const ids = await listActiveIdsInRowidRange(
		env.DB,
		startRowid,
		startRowid + SITEMAP_BLOCK_SIZE - 1,
	);
	// Only home, /subjects, and /developers ride page 0: /subjects/new,
	// /contact, /privacy, and /terms are noindex, and noindex URLs do not
	// belong in a sitemap.
	const barePaths = [
		...(page === 0 ? ["", "/subjects", "/developers"] : []),
		...ids.map((id) => `/subjects/${id}`),
	];
	return urlsetResponse(barePaths.map((path) => urlEntries(site.canonical, path)).join(""));
}
