/**
 * Period windows for count aggregation.
 *
 * All days are UTC ISO dates. Counters are stored per UTC day; weeks are ISO
 * weeks (Monday-based). UTC keeps one consistent day boundary for a service
 * whose subjects span time zones; the ±hours skew is invisible at display granularity.
 */

export type IsoDate = string; // '2026-08-14'

export interface DayRange {
	/** Inclusive first day. */
	start: IsoDate;
	/** Inclusive last day. */
	end: IsoDate;
}

export function toIsoDate(date: Date): IsoDate {
	return date.toISOString().slice(0, 10);
}

function utcMidnight(date: Date): Date {
	return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addDays(date: Date, days: number): Date {
	const result = new Date(date);
	result.setUTCDate(result.getUTCDate() + days);
	return result;
}

/** ISO-week id like '2026-W33'. */
export function isoWeekId(date: Date): string {
	// ISO week number: the week containing the year's first Thursday is week 1.
	const day = utcMidnight(date);
	const thursday = addDays(day, 3 - ((day.getUTCDay() + 6) % 7));
	const yearStart = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1));
	const week = Math.ceil(((thursday.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
	return `${thursday.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** Monday..Sunday range of the ISO week containing `date`. */
export function weekRange(date: Date): DayRange {
	const day = utcMidnight(date);
	const monday = addDays(day, -((day.getUTCDay() + 6) % 7));
	return { start: toIsoDate(monday), end: toIsoDate(addDays(monday, 6)) };
}

/** The most recent `count` ISO weeks, oldest first, current week last (for the Atom feed). */
export function recentWeeks(date: Date, count: number): DayRange[] {
	const currentMonday = new Date(`${weekRange(date).start}T00:00:00Z`);
	return Array.from({ length: count }, (_, i) =>
		weekRange(addDays(currentMonday, (i - (count - 1)) * 7)),
	);
}

/** First..last day of the calendar month containing `date`. */
export function monthRange(date: Date): DayRange {
	const first = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
	const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
	return { start: toIsoDate(first), end: toIsoDate(last) };
}

/** First..last day of the calendar year containing `date`. */
export function yearRange(date: Date): DayRange {
	const year = date.getUTCFullYear();
	return { start: `${year}-01-01`, end: `${year}-12-31` };
}

/**
 * A period is a day range, or null for all time. The wire formats are
 * '2026-W33' (ISO week), '2026-08' (calendar month), '2026' (calendar year),
 * and 'all'; undefined marks malformed input.
 */
export type Period = DayRange | null;

export function parsePeriod(value: string): Period | undefined {
	if (value === "all") {
		return null;
	}
	if (/^\d{4}$/.test(value)) {
		return yearRange(new Date(`${value}-01-01T00:00:00Z`));
	}
	if (/^\d{4}-\d{2}$/.test(value)) {
		const date = new Date(`${value}-01T00:00:00Z`);
		return Number.isNaN(date.getTime()) ? undefined : monthRange(date);
	}
	return parseIsoWeek(value);
}

const ISO_WEEK_PATTERN = /^(?<year>\d{4})-W(?<week>\d{2})$/;

/** Parse '2026-W33' into its Monday..Sunday range; undefined for malformed or out-of-range input. */
export function parseIsoWeek(value: string): DayRange | undefined {
	const match = ISO_WEEK_PATTERN.exec(value);
	if (!match?.groups) {
		return undefined;
	}
	const year = Number(match.groups["year"]);
	const week = Number(match.groups["week"]);
	if (week < 1 || week > 53) {
		return undefined;
	}
	// Jan 4 is always in ISO week 1; walk to that week's Monday, then offset.
	const jan4 = new Date(Date.UTC(year, 0, 4));
	const week1Monday = addDays(jan4, -((jan4.getUTCDay() + 6) % 7));
	const monday = addDays(week1Monday, (week - 1) * 7);
	if (isoWeekId(monday) !== value) {
		return undefined;
	} // e.g. W53 of a 52-week year
	return { start: toIsoDate(monday), end: toIsoDate(addDays(monday, 6)) };
}
