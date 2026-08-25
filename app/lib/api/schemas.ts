/**
 * The single source of truth for API shapes: zod schemas double as runtime
 * validators and OpenAPI generators. Never hand-edit a spec file — extend
 * these schemas and the manifest instead.
 */

import * as z from "zod";

import { MIN_QUERY_LENGTH } from "~/lib/api/constants";
import { DISPLAY_CAP, displayValue } from "~/lib/display-value";
import type { CountsSummary, NearbySubject, SubjectRow } from "~/lib/server/db";

// The public Subject exposes exactly what a reader needs and nothing that
// identifies, ranks, or leaks. Hidden columns, deliberately:
// - rowid: internal PK and keyset-cursor detail; exposing it invites
//   enumeration and order-of-creation scraping.
// - geohash: an index artifact derived from lat/lng — clients that need a
//   cell can derive it.
// - status: constant on public surfaces (non-active subjects 404 everywhere),
//   so the field would carry zero information.
// - created_at: no consumer use case, and ordering by age is one step from a
//   ranking surface.
// - created_ip: legal traceability only (AGENTS.md "Zero visitor data");
//   must never cross the API boundary.
export const subjectSchema = z.object({
	id: z.string().describe("Public identifier; the page URL is /subjects/{id}"),
	name: z.string(),
	lat: z.number().nullable().describe("Spatial dimension (optional)"),
	lng: z.number().nullable(),
});

export function toApiSubject(row: SubjectRow): z.infer<typeof subjectSchema> {
	return {
		id: row.id,
		name: row.name,
		lat: row.lat,
		lng: row.lng,
	};
}

const nearbySubjectSchema = subjectSchema.extend({
	distance_m: z.number().describe("Great-circle distance from the query point, meters"),
});

export function toApiNearbySubject(row: NearbySubject): z.infer<typeof nearbySubjectSchema> {
	return { ...toApiSubject(row), distance_m: row.distance_m };
}

const displayValueSchema = z
	.string()
	.describe(`Display value: the exact count up to ${DISPLAY_CAP}, "${DISPLAY_CAP}+" beyond`);

export const subjectListResponseSchema = z.object({
	subjects: z.array(subjectSchema),
	next_cursor: z
		.string()
		.nullable()
		.describe("Opaque keyset cursor; null on the last page. Absent semantics for near queries."),
});

export const nearListResponseSchema = z.object({
	subjects: z.array(nearbySubjectSchema),
});

export const reactionsResponseSchema = z.object({
	id: z.string(),
	total: displayValueSchema.describe("All-time total"),
	by_type: z.record(z.string(), displayValueSchema),
});

export function toApiReactions(
	id: string,
	summary: CountsSummary,
): z.infer<typeof reactionsResponseSchema> {
	return {
		id,
		total: displayValue(summary.total),
		by_type: Object.fromEntries(
			Object.entries(summary.byType).map(([type, count]) => [type, displayValue(count)]),
		),
	};
}

export const errorResponseSchema = z.object({ error: z.string() });

// --- Query parameter schemas (also feed OpenAPI `parameters`). ---

export const subjectListQuerySchema = z.object({
	q: z
		.string()
		.min(MIN_QUERY_LENGTH)
		.max(100)
		.optional()
		.describe(
			"Free-text name search (Japanese and English). 1-2 characters match as a name prefix; 3 or more match anywhere in the name",
		),
	near: z
		.string()
		.regex(/^-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?$/)
		.optional()
		.describe("lat,lng — switches to distance-ordered near search (no cursor)"),
	radius: z.coerce
		.number()
		.int()
		.min(1)
		.max(50_000)
		.default(3000)
		.describe("Near-search radius in meters"),
	limit: z.coerce.number().int().min(1).max(100).default(20).describe("Page size"),
	cursor: z.string().optional().describe("Keyset cursor from a previous page"),
});
