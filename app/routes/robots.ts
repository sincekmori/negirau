// GET /robots.txt — served by the worker (not a static asset) so the sitemap
// URL rides the configured domain.
//
// Policy (deliberate): everything is open to crawling, AI training included —
// the whole point is for this work to be found and reused. Pages that should
// stay out of search results carry `noindex` robots meta tags in their routes
// instead of Disallow rules here: a Disallow would hide the noindex from
// crawlers, and the URL could still be indexed reference-style.

import { appContext } from "~/lib/context";
import { edgeCachedByUrl } from "~/lib/server/edge-cache";
import { cachedResponse } from "~/lib/server/route-helpers";

import type { Route } from "./+types/robots";

export function loader(args: Route.LoaderArgs) {
	// Read-only representation: served through the edge cache (URL-keyed).
	const { ctx } = args.context.get(appContext);
	return edgeCachedByUrl(args.request, ctx, () => Promise.resolve(produce(args)));
}

function produce({ context }: Route.LoaderArgs) {
	const { site } = context.get(appContext);
	const body = `# Everyone is welcome — search engines and AI crawlers alike.
User-agent: *
Disallow:

Sitemap: ${site.canonical}/sitemap.xml
`;
	return cachedResponse(body, "text/plain; charset=utf-8", 3600);
}
