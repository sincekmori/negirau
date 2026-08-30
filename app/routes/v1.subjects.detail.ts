// GET /v1/subjects/:id — a single subject.

import { toApiSubject } from "~/lib/api/schemas";
import { appContext } from "~/lib/context";
import { getActiveSubject } from "~/lib/server/db";
import { edgeCachedLoader } from "~/lib/server/edge-cache";
import { publicJson } from "~/lib/server/public-json";
import { apiError } from "~/lib/server/route-helpers";

import type { Route } from "./+types/v1.subjects.detail";

export const loader = edgeCachedLoader(produce);

async function produce({ params, context }: Route.LoaderArgs) {
	const { env } = context.get(appContext);
	const subject = await getActiveSubject(env.DB, params.id);
	if (!subject) {
		return apiError(404, "not_found");
	}
	return publicJson(toApiSubject(subject));
}
