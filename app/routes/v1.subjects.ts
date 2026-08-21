// GET /v1/subjects — list/search, or near search when ?near= is present.

import type * as z from "zod";

import { subjectListQuerySchema, toApiNearbySubject, toApiSubject } from "~/lib/api/schemas";
import { appContext } from "~/lib/context";
import { decodeCursor, paginate } from "~/lib/cursor";
import { parseLatLng } from "~/lib/geo";
import {
	TRIGRAM_QUERY_MIN,
	listSubjects,
	listSubjectsByNamePrefix,
	listSubjectsNear,
} from "~/lib/server/db";
import { edgeCachedByUrl } from "~/lib/server/edge-cache";
import { publicJson } from "~/lib/server/public-json";
import { apiError } from "~/lib/server/route-helpers";

import type { Route } from "./+types/v1.subjects";

type Query = z.infer<typeof subjectListQuerySchema>;

async function nearSearch(
	db: D1Database,
	near: string,
	radius: number,
	limit: number,
): Promise<Response> {
	const point = parseLatLng(near);
	if (!point) {
		return apiError(400, "invalid_query");
	}
	const rows = await listSubjectsNear(db, point.lat, point.lng, radius, limit);
	return publicJson({ subjects: rows.map((row) => toApiNearbySubject(row)) });
}

async function pagedList(env: Env, query: Query, limit: number): Promise<Response> {
	const db = env.DB;
	const afterRowid =
		query.cursor === undefined
			? undefined
			: await decodeCursor(env.TURNSTILE_SECRET_KEY, query.cursor);
	if (query.cursor !== undefined && afterRowid === undefined) {
		return apiError(400, "invalid_cursor");
	}
	// Prefix mode (a query too short for the trigram index) is one page by
	// design: name-ordered, so the rowid keyset does not apply.
	if (query.q !== undefined && query.q.length < TRIGRAM_QUERY_MIN) {
		const rows = await listSubjectsByNamePrefix(db, query.q, limit);
		return publicJson({
			subjects: rows.map((row) => toApiSubject(row)),
			next_cursor: null,
		});
	}
	// Fetch one extra row to know whether a next page exists.
	const rows = await listSubjects(db, {
		q: query.q,
		limit: limit + 1,
		afterRowid,
	});
	const { page, nextCursor } = await paginate(env.TURNSTILE_SECRET_KEY, rows, limit);
	return publicJson({
		subjects: page.map((row) => toApiSubject(row)),
		next_cursor: nextCursor,
	});
}

export function loader(args: Route.LoaderArgs) {
	// Read-only representation: served through the edge cache (URL-keyed).
	const { ctx } = args.context.get(appContext);
	return edgeCachedByUrl(args.request, ctx, () => Promise.resolve(produce(args)));
}

function produce({ request, context }: Route.LoaderArgs) {
	const { env } = context.get(appContext);
	const query = subjectListQuerySchema.safeParse(
		Object.fromEntries(new URL(request.url).searchParams),
	);
	if (!query.success) {
		return apiError(400, "invalid_query");
	}
	const { limit } = query.data;
	if (query.data.near !== undefined) {
		const { radius } = query.data;
		return nearSearch(env.DB, query.data.near, radius, limit);
	}
	return pagedList(env, query.data, limit);
}
