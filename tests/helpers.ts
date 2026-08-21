// Shared fixtures for the workers-pool tests.

import { env } from "cloudflare:test";

import { createSubject } from "~/lib/server/db";
import type { SubjectRow } from "~/lib/server/db";

/** Wipe every mutable table. */
export async function resetDb(): Promise<void> {
	for (const table of ["reaction_counts", "subject_requests", "subjects"]) {
		await env.DB.prepare(`DELETE FROM ${table}`).run();
	}
}

/** Minimal subject fixture; spatial when coordinates are given. */
export function seedSubject(
	name: string,
	lat: number | null = null,
	lng: number | null = null,
	listed = true,
): Promise<SubjectRow> {
	return createSubject(env.DB, {
		name,
		lat,
		lng,
		listed,
		createdIp: "203.0.113.1",
	});
}
