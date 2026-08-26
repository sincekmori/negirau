// GET /subjects/:id/og — the subject's OGP card with the all-time display value.

import { appContext } from "~/lib/context";
import { DEFAULT_LOCALE, messages, totalHeadline } from "~/lib/i18n";
import { countsSummary } from "~/lib/server/db";
import { edgeCachedByUrl } from "~/lib/server/edge-cache";
import { ogCardResponse } from "~/lib/server/og-card";
import { loadActiveSubject } from "~/lib/server/route-helpers";

import type { Route } from "./+types/og";

export function loader(args: Route.LoaderArgs) {
	// Read-only representation: served through the edge cache (URL-keyed), so
	// a crawler burst costs one D1 read per TTL, not one per hit — the
	// synthetic-key card cache behind it only ever spared the Satori render.
	const { ctx } = args.context.get(appContext);
	return edgeCachedByUrl(args.request, ctx, () => produce(args));
}

async function produce({ params, context }: Route.LoaderArgs) {
	const { env, ctx, site } = context.get(appContext);
	const subject = await loadActiveSubject(env.DB, params.id);
	const summary = await countsSummary(env.DB, subject.rowid);
	// OGP crawlers send no meaningful language; the image renders in the default locale.
	const headline = totalHeadline(messages(DEFAULT_LOCALE), summary.total);
	return ogCardResponse(ctx, params.id, subject.name, headline, site.host);
}
