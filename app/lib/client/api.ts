/**
 * The browser's typed access to the public read API — the same contract the
 * spec and both published clients consume, so a renamed parameter or moved
 * prefix breaks here at compile time instead of silently in production.
 * Response shapes are structural mirrors of app/lib/api/schemas.ts (importing
 * the zod schemas would drag zod into the client bundle).
 */

import { ROUTE_PREFIX } from "~/lib/api/constants";

export interface ApiSubject {
	id: string;
	name: string;
	lat: number | null;
	lng: number | null;
}

export interface ApiNearbySubject extends ApiSubject {
	distance_m: number;
}

async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
	const response = await fetch(`${ROUTE_PREFIX}${path}`, { signal });
	if (!response.ok) {
		throw new Error(`api ${response.status}`);
	}
	return (await response.json()) as T;
}

export async function searchSubjects(
	q: string,
	limit: number,
	signal?: AbortSignal,
): Promise<ApiSubject[]> {
	const data = await getJson<{ subjects: ApiSubject[] }>(
		`/subjects?q=${encodeURIComponent(q)}&limit=${limit}`,
		signal,
	);
	return data.subjects;
}

/** Nearby subjects that actually carry coordinates (the null-narrowing lives here). */
export async function nearbySubjects(
	args: { lat: number; lng: number; radius: number; limit: number },
	signal?: AbortSignal,
): Promise<(ApiNearbySubject & { lat: number; lng: number })[]> {
	const data = await getJson<{ subjects: ApiNearbySubject[] }>(
		`/subjects?near=${args.lat.toFixed(5)},${args.lng.toFixed(5)}&radius=${args.radius}&limit=${args.limit}`,
		signal,
	);
	return data.subjects.filter(
		(subject): subject is ApiNearbySubject & { lat: number; lng: number } =>
			subject.lat !== null && subject.lng !== null,
	);
}
