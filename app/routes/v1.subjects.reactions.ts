// GET /v1/subjects/:id/reactions — display values over a period.

import { reactionsQuerySchema, toApiReactions } from "~/lib/api/schemas";
import { appContext } from "~/lib/context";
import { parsePeriod } from "~/lib/period";
import { countsSummary, getActiveSubject } from "~/lib/server/db";
import { edgeCachedByUrl } from "~/lib/server/edge-cache";
import { publicJson } from "~/lib/server/public-json";
import { apiError } from "~/lib/server/route-helpers";

import type { Route } from "./+types/v1.subjects.reactions";

export function loader(args: Route.LoaderArgs) {
	// Read-only representation: served through the edge cache (URL-keyed).
	const { ctx } = args.context.get(appContext);
	return edgeCachedByUrl(args.request, ctx, () => Promise.resolve(produce(args)));
}

async function produce({ request, params, context }: Route.LoaderArgs) {
	const { env } = context.get(appContext);
	const query = reactionsQuerySchema.safeParse(
		Object.fromEntries(new URL(request.url).searchParams),
	);
	if (!query.success) {
		return apiError(400, "invalid_query");
	}
	// No period means the all-time totals — the least surprising default for a
	// read API (the weekly view is the UI's choice, not the contract's).
	const periodId = query.data.period ?? "all";
	const period = parsePeriod(periodId);
	if (period === undefined) {
		return apiError(400, "invalid_period");
	}
	const subject = await getActiveSubject(env.DB, params.id);
	if (!subject) {
		return apiError(404, "not_found");
	}
	const summary = await countsSummary(env.DB, subject.rowid, period);
	return publicJson(toApiReactions(subject.id, periodId, summary));
}
