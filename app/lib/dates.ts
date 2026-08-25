/**
 * UTC date helpers for the daily counters and the feed's entry cadence.
 * Aggregation windows used to live here too; every public surface now sums
 * all time, so only the day key and the ISO-week id remain.
 */

/** ISO date in UTC — the reaction counters' day key. */
export type IsoDate = string; // '2026-08-14'

export function toIsoDate(date: Date): IsoDate {
	return date.toISOString().slice(0, 10);
}

function utcMidnight(date: Date): Date {
	return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addDays(date: Date, days: number): Date {
	const out = new Date(date);
	out.setUTCDate(out.getUTCDate() + days);
	return out;
}

/** ISO-week id like '2026-W33' — the feed's entry cadence, nothing more. */
export function isoWeekId(date: Date): string {
	// ISO week number: the week containing the year's first Thursday is week 1.
	const day = utcMidnight(date);
	const thursday = addDays(day, 3 - ((day.getUTCDay() + 6) % 7));
	const yearStart = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1));
	const week = Math.ceil(((thursday.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
	return `${thursday.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}
