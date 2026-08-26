// GET /subjects/:id/badge — the identity badge: {icon} Negirau | {subject.name}.

import { appContext } from "~/lib/context";
import { badgeResponse, renderBadgeSvg } from "~/lib/server/badge";
import { edgeCachedByUrl } from "~/lib/server/edge-cache";
import { loadActiveSubject } from "~/lib/server/route-helpers";

import type { Route } from "./+types/badge";

export function loader(args: Route.LoaderArgs) {
	// Read-only representation: served through the edge cache (URL-keyed).
	const { ctx } = args.context.get(appContext);
	return edgeCachedByUrl(args.request, ctx, () => produce(args));
}

async function produce({ params, context }: Route.LoaderArgs) {
	const { env } = context.get(appContext);
	const subject = await loadActiveSubject(env.DB, params.id);
	return badgeResponse(renderBadgeSvg(subject.name));
}
