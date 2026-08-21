// GET /subjects/:id/badge — the display badge: {icon} {subject.name} | {value}/{period}.

import { appContext } from "~/lib/context";
import { displayValue } from "~/lib/display-value";
import { DEFAULT_LOCALE, isLocale, messages } from "~/lib/i18n";
import { monthRange, weekRange, yearRange } from "~/lib/period";
import type { Period } from "~/lib/period";
import { badgeResponse, renderBadgeSvg } from "~/lib/server/badge";
import { countsSummary } from "~/lib/server/db";
import { edgeCachedByUrl } from "~/lib/server/edge-cache";
import { loadActiveSubject } from "~/lib/server/route-helpers";

import type { Route } from "./+types/badge";

// The badge's period vocabulary is relative (this week/month/year/all),
// unlike the API's absolute ISO periods; suffix copy lives in the catalog.
const PERIOD_RANGES = {
	week: weekRange,
	month: monthRange,
	year: yearRange,
	// All time carries no suffix: the bare number reads as the total.
	all: () => null,
} as const satisfies Record<string, (now: Date) => Period>;

function isPeriodKey(value: string): value is keyof typeof PERIOD_RANGES {
	return value in PERIOD_RANGES;
}

export function loader(args: Route.LoaderArgs) {
	// Read-only representation: served through the edge cache (URL-keyed).
	const { ctx } = args.context.get(appContext);
	return edgeCachedByUrl(args.request, ctx, () => Promise.resolve(produce(args)));
}

async function produce({ request, params, context }: Route.LoaderArgs) {
	const { env } = context.get(appContext);
	const url = new URL(request.url);
	const periodKey = url.searchParams.get("period") ?? "all";
	if (!isPeriodKey(periodKey)) {
		return new Response("unknown period", { status: 400 });
	}
	const langParam = url.searchParams.get("lang") ?? DEFAULT_LOCALE;
	const lang = isLocale(langParam) ? langParam : DEFAULT_LOCALE;
	const subject = await loadActiveSubject(env.DB, params.id);
	const summary = await countsSummary(env.DB, subject.rowid, PERIOD_RANGES[periodKey](new Date()));
	const suffix = periodKey === "all" ? "" : `/${messages(lang).badgePeriodSuffix[periodKey]}`;
	return badgeResponse(renderBadgeSvg(subject.name, `${displayValue(summary.total)}${suffix}`));
}
