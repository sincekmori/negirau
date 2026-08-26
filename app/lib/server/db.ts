/**
 * All D1 access lives here. Subjects are abstract: a name plus an optional
 * location. Read surfaces see active subjects only; quarantined and
 * removed rows exist solely for the operator's SQL. Unlisted subjects
 * (listed = 0) stay off every enumeration surface — search, listings,
 * nearby, sitemap — but the page itself answers to anyone with the link, so
 * only getActiveSubject skips the filter.
 */

import { boundingBoxAround, haversineMeters } from "~/lib/geo";
import { coveringCells, encodeGeohash } from "~/lib/geohash";

// Only the columns any caller reads: status is pinned by each query's own
// predicate, geohash and created_at have no readers outside this module.
export interface SubjectRow {
	rowid: number;
	id: string;
	name: string;
	lat: number | null;
	lng: number | null;
	/** 1 = on enumeration surfaces, 0 = reachable by link only. */
	listed: number;
}

const SUBJECT_SELECT = "SELECT rowid, id, name, lat, lng, listed FROM subjects";

/** The one definition of "publicly enumerable" — every listing surface uses it. */
const ENUMERABLE = "status = 'active' AND listed = 1";

/** Public lookup: active subjects only (quarantined and removed are invisible). */
export async function getActiveSubject(
	db: D1Database,
	id: string,
): Promise<SubjectRow | undefined> {
	const row = await db
		.prepare(`${SUBJECT_SELECT} WHERE id = ? AND status = 'active'`)
		.bind(id)
		.first<SubjectRow>();
	return row ?? undefined;
}

export interface NewSubject {
	name: string;
	lat: number | null;
	lng: number | null;
	/** false keeps the subject off search/listings; the link still works. */
	listed: boolean;
	/** The creator's IP, kept for legal traceability; never used otherwise. */
	createdIp: string;
}

/** Create a subject with a fresh UUID; returns the created row. */
export async function createSubject(db: D1Database, subject: NewSubject): Promise<SubjectRow> {
	const id = crypto.randomUUID();
	const geohash =
		subject.lat !== null && subject.lng !== null ? encodeGeohash(subject.lat, subject.lng) : null;
	const row = await db
		.prepare(
			`INSERT INTO subjects (id, name, lat, lng, geohash, listed, created_at, created_ip)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?)
			 RETURNING rowid, id, name, lat, lng, listed`,
		)
		.bind(
			id,
			subject.name,
			subject.lat,
			subject.lng,
			geohash,
			subject.listed ? 1 : 0,
			new Date().toISOString(),
			subject.createdIp,
		)
		.first<SubjectRow>();
	if (!row) {
		throw new Error("insert returned no row");
	}
	return row;
}

/**
 * Queue an anonymous update/delete request for the operator's daily review.
 * One live row per subject x kind: a newer request replaces the pending one,
 * so the table stays bounded by the subject count.
 */
export async function upsertSubjectRequest(
	db: D1Database,
	subjectRowid: number,
	kind: "update" | "delete",
	payload: string | null,
): Promise<void> {
	await db
		.prepare(
			`INSERT OR REPLACE INTO subject_requests (subject_rowid, kind, payload, created_at)
			 VALUES (?, ?, ?, ?)`,
		)
		.bind(subjectRowid, kind, payload, new Date().toISOString())
		.run();
}

/**
 * The daily nudge's numbers, both bounded: the queue by its PK (≤ 2 per
 * subject), the fresh count by a newest-500 window (rowid tracks creation
 * order) so the scan never grows with the table. 500 saturates the count,
 * which is plenty for a "go look at the queue" signal.
 */
export async function reviewQueueCounts(
	db: D1Database,
): Promise<{ requests: number; fresh: number }> {
	const row = await db
		.prepare(
			`SELECT (SELECT COUNT(*) FROM subject_requests) AS requests,
			        (SELECT COUNT(*)
			           FROM (SELECT created_at FROM subjects ORDER BY rowid DESC LIMIT 500)
			          -- created_at is an ISO string ("...T...Z"); datetime() would
			          -- return a space-separated one, and the text compare puts
			          -- every "T" above the space — counting yesterday as fresh.
			          WHERE created_at >= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-1 day')) AS fresh`,
		)
		.first<{ requests: number; fresh: number }>();
	return row ?? { requests: 0, fresh: 0 };
}

export interface SubjectListFilter {
	/** Free-text name search: prefix seek below TRIGRAM_QUERY_MIN, trigram FTS from there. */
	q?: string;
	/** Keyset cursor: rows strictly after this rowid. */
	afterRowid?: number;
	limit: number;
}

/**
 * Below this length the trigram FTS index cannot match at all; callers switch
 * to listSubjectsByNamePrefix instead.
 */
export const TRIGRAM_QUERY_MIN = 3;

/**
 * Search for queries too short for the trigram index (autocomplete semantics:
 * "嵐" or "田中" find names starting with them, ordered by name). A range
 * seek on the partial name index reads at most `limit` enumerable rows.
 * Single-shot by design — the rowid keyset cursor belongs to listSubjects.
 */
export async function listSubjectsByNamePrefix(
	db: D1Database,
	q: string,
	limit: number,
): Promise<SubjectRow[]> {
	// U+10FFFF is the top code point, so the upper bound covers astral
	// characters right after the prefix.
	const { results } = await db
		.prepare(
			`${SUBJECT_SELECT} WHERE ${ENUMERABLE} AND name >= ?1 AND name < ?2
			 ORDER BY name LIMIT ?3`,
		)
		.bind(q, `${q}\u{10FFFF}`, limit)
		.all<SubjectRow>();
	return results;
}

export async function listSubjects(
	db: D1Database,
	filter: SubjectListFilter,
): Promise<SubjectRow[]> {
	const conditions = [ENUMERABLE];
	const bindings: (string | number)[] = [];
	if (filter.q !== undefined) {
		// Quoted-string MATCH on the trigram FTS table: the join + ORDER BY
		// rowid lets FTS stream matches in id order and stop at the limit, so
		// a frequent term costs ~limit rows — on D1, scanned rows are billed.
		conditions.push("subjects_fts MATCH ?");
		bindings.push(`"${filter.q.replaceAll('"', '""')}"`);
	}
	if (filter.afterRowid !== undefined) {
		// Constrain the FTS side when searching: FTS5 consumes the rowid bound
		// and seeks within the doclist, so page n costs ~limit rows, not n×limit.
		conditions.push(filter.q === undefined ? "subjects.rowid > ?" : "subjects_fts.rowid > ?");
		bindings.push(filter.afterRowid);
	}
	const from =
		filter.q === undefined
			? "FROM subjects"
			: "FROM subjects_fts JOIN subjects ON subjects.rowid = subjects_fts.rowid";
	const orderBy = filter.q === undefined ? "subjects.rowid" : "subjects_fts.rowid";
	const { results } = await db
		.prepare(
			`SELECT subjects.rowid AS rowid, subjects.id, subjects.name, subjects.lat, subjects.lng,
			        subjects.listed
			 ${from} WHERE ${conditions.join(" AND ")} ORDER BY ${orderBy} LIMIT ?`,
		)
		.bind(...bindings, filter.limit)
		.all<SubjectRow>();
	return results;
}

/** The columns the newest-first listings actually render. */
export interface SubjectSummary {
	rowid: number;
	id: string;
	name: string;
}

/**
 * One newest-first page: the home shelf (no cursor) and the /subjects
 * listing (keyset by rowid, descending) are the same query. Narrow select —
 * the callers render names and links, nothing more.
 */
export async function listSubjectsBefore(
	db: D1Database,
	beforeRowid: number | undefined,
	limit: number,
): Promise<SubjectSummary[]> {
	const conditions = [ENUMERABLE];
	const bindings: number[] = [];
	if (beforeRowid !== undefined) {
		conditions.push("rowid < ?");
		bindings.push(beforeRowid);
	}
	const { results } = await db
		.prepare(
			`SELECT rowid, id, name FROM subjects WHERE ${conditions.join(" AND ")}
			 ORDER BY rowid DESC LIMIT ?`,
		)
		.bind(...bindings, limit)
		.all<SubjectSummary>();
	return results;
}

export interface NearbySubject extends SubjectRow {
	distance_m: number;
}

/** Well above any sensible `limit` (max 100), well below a metro-area box's row count. */
const NEAR_SQL_ROW_CAP = 500;

export async function listSubjectsNear(
	db: D1Database,
	lat: number,
	lng: number,
	radiusMeters: number,
	limit: number,
): Promise<NearbySubject[]> {
	// Geohash-cover prefilter: one index seek per covering cell, so rows read
	// scale with subjects actually near the point — a plain lat BETWEEN would
	// scan the whole latitude band worldwide (which is also why subjects has
	// no lat/lng index: the planner would prefer it over these seeks).
	// Exact haversine + sort in JS
	// (truncation-style, no cursor); the row cap keeps a dense metro box from
	// pulling thousands of rows into the Worker.
	const box = boundingBoxAround(lat, lng, radiusMeters);
	const cells = coveringCells(box);
	if (cells.length === 0) {
		return [];
	}
	const cosLat = Math.cos((lat * Math.PI) / 180);
	const prefixSeeks = cells.map(() => "(geohash >= ? AND geohash < ?)").join(" OR ");
	const { results } = await db
		.prepare(
			`${SUBJECT_SELECT}
			 WHERE ${ENUMERABLE} AND (${prefixSeeks})
			   AND lat BETWEEN ? AND ? AND lng BETWEEN ? AND ?
			 ORDER BY (lat - ?) * (lat - ?) + (lng - ?) * (lng - ?) * ? * ?
			 LIMIT ${NEAR_SQL_ROW_CAP}`,
		)
		.bind(
			...cells.flatMap((cell) => [cell, `${cell}~`]),
			box.minLat,
			box.maxLat,
			box.minLng,
			box.maxLng,
			lat,
			lat,
			lng,
			lng,
			cosLat,
			cosLat,
		)
		.all<SubjectRow>();
	return results
		.map((row) =>
			Object.assign(row, {
				distance_m: Math.round(haversineMeters(lat, lng, row.lat as number, row.lng as number)),
			}),
		)
		.filter((row) => row.distance_m <= radiusMeters)
		.toSorted((a, b) => a.distance_m - b.distance_m)
		.slice(0, limit);
}

export interface CountsSummary {
	total: number;
	byType: Record<string, number>;
}

/** Sum the daily counters over all time — the only aggregation any surface shows. */
export async function countsSummary(db: D1Database, subjectRowid: number): Promise<CountsSummary> {
	const { results } = await db
		.prepare(
			`SELECT type, SUM(count) AS total FROM reaction_counts
			 WHERE subject_rowid = ? GROUP BY type HAVING total > 0`,
		)
		.bind(subjectRowid)
		.all<{ type: string; total: number }>();
	const byType: Record<string, number> = {};
	let total = 0;
	for (const row of results) {
		byType[row.type] = row.total;
		total += row.total;
	}
	return { total, byType };
}

export async function recordReaction(
	db: D1Database,
	subjectRowid: number,
	type: string,
	day: string,
): Promise<void> {
	await db
		.prepare(
			`INSERT INTO reaction_counts (subject_rowid, type, day, count) VALUES (?, ?, ?, 1)
			 ON CONFLICT (subject_rowid, type, day) DO UPDATE SET count = count + 1`,
		)
		.bind(subjectRowid, type, day)
		.run();
}

export async function revokeReaction(
	db: D1Database,
	subjectRowid: number,
	type: string,
	day: string,
): Promise<void> {
	await db
		.prepare(
			`UPDATE reaction_counts SET count = MAX(count - 1, 0)
			 WHERE subject_rowid = ? AND type = ? AND day = ?`,
		)
		.bind(subjectRowid, type, day)
		.run();
}

/**
 * Past this many reaction_counts rows, the all-time summaries scan enough that
 * the totals-rollup table is worth designing. Single source: the nudge mail
 * and the ops review gauge both read it from here.
 */
export const ROLLUP_WATCH_THRESHOLD = 100_000;

/**
 * Growth gauge for reaction_counts: the highest rowid approximates rows ever
 * inserted (1 row read). Deliberately a proxy, not a COUNT(*): an exact
 * count would scan the whole table daily.
 */
export async function reactionRowsGauge(db: D1Database): Promise<number> {
	const row = await db
		.prepare("SELECT MAX(rowid) AS n FROM reaction_counts")
		.first<{ n: number | null }>();
	return row?.n ?? 0;
}

/** Highest subject rowid — the sitemap index derives its page count from it (1 row read). */
export async function maxSubjectRowid(db: D1Database): Promise<number> {
	const row = await db.prepare("SELECT MAX(rowid) AS max_rowid FROM subjects").first<{
		max_rowid: number | null;
	}>();
	return row?.max_rowid ?? 0;
}

/** Active ids within a rowid block — bounds rows_read per sitemap page. */
export async function listActiveIdsInRowidRange(
	db: D1Database,
	startRowid: number,
	endRowid: number,
): Promise<string[]> {
	const { results } = await db
		.prepare(`SELECT id FROM subjects WHERE ${ENUMERABLE} AND rowid BETWEEN ? AND ? ORDER BY rowid`)
		.bind(startRowid, endRowid)
		.all<{ id: string }>();
	return results.map((row) => row.id);
}
