/* SPDX-License-Identifier: Apache-2.0 */

/** Public response types, contract-tested against the spec (tests/contract.test.ts). */

/** Display value — the only count representation the API ever exposes: exact up to 100, "100+" beyond. */
export type DisplayValue = string;

/** A recipient of appreciation — a name, optionally with a location and an active period. */
export interface Subject {
	/** Public identifier; the page URL is https://negirau.com/subjects/{id}. */
	id: string;
	name: string;
	lat: number | null;
	lng: number | null;
}

/** A subject returned by a near search, with its distance from the query point. */
export interface NearbySubject extends Subject {
	distance_m: number;
}

/** One page of a cursor-paginated subject listing. */
export interface SubjectPage {
	subjects: Subject[];
	next_cursor: string | null;
}

export interface SubjectListParams {
	/** Free-text name search: 1-2 characters match as a name prefix, 3+ anywhere in the name. */
	q?: string;
	/** Page size (1-100, default 20). */
	limit?: number;
	cursor?: string;
}

/** Reaction display values for one subject over a period. */
export interface ReactionsSummary {
	id: string;
	/** The aggregation period as requested ('2026-W33', '2026-08', '2026', or 'all'). */
	period: string;
	total: DisplayValue;
	by_type: Record<string, DisplayValue>;
}
