// GET /subjects/:id/og — the subject's OGP card with the weekly display value.

import { appContext } from "~/lib/context";
import { displayValue } from "~/lib/display-value";
import { DEFAULT_LOCALE, messages, totalHeadline } from "~/lib/i18n";
import { countsSummary } from "~/lib/server/db";
import { ogCardResponse } from "~/lib/server/og-card";
import { loadActiveSubject } from "~/lib/server/route-helpers";

import type { Route } from "./+types/og";

export async function loader({ params, context }: Route.LoaderArgs) {
	const { env, ctx, site } = context.get(appContext);
	const subject = await loadActiveSubject(env.DB, params.id);
	const summary = await countsSummary(env.DB, subject.rowid);
	// OGP crawlers send no meaningful language; the image renders in the default locale.
	const headline = totalHeadline(
		messages(DEFAULT_LOCALE),
		summary.total === 0 ? undefined : displayValue(summary.total),
	);
	return ogCardResponse(ctx, params.id, subject.name, headline, site.host);
}
