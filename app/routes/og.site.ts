// GET /og/site — the top page's OGP card: brand only, language-neutral.

import { appContext } from "~/lib/context";
import { ogCardResponse } from "~/lib/server/og-card";

import type { Route } from "./+types/og.site";

export function loader({ context }: Route.LoaderArgs) {
	const { ctx, site } = context.get(appContext);
	return ogCardResponse(ctx, "site", "Negirau", "", site.host);
}
