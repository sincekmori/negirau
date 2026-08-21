// GET /v1/subjects/:id — a single subject.

import { toApiSubject } from "~/lib/api/schemas";
import { appContext } from "~/lib/context";
import { getActiveSubject } from "~/lib/server/db";
import { edgeCachedByUrl } from "~/lib/server/edge-cache";
import { publicJson } from "~/lib/server/public-json";
import { apiError } from "~/lib/server/route-helpers";

import type { Route } from "./+types/v1.subjects.detail";

export function loader(args: Route.LoaderArgs) {
	// Read-only representation: served through the edge cache (URL-keyed).
	const { ctx } = args.context.get(appContext);
	return edgeCachedByUrl(args.request, ctx, () => Promise.resolve(produce(args)));
}

async function produce({ params, context }: Route.LoaderArgs) {
	const { env } = context.get(appContext);
	const subject = await getActiveSubject(env.DB, params.id);
	if (!subject) {
		return apiError(404, "not_found");
	}
	return publicJson(toApiSubject(subject));
}
