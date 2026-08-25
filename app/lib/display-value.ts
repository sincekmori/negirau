/**
 * The public display value for a reaction count: exact up to 100, capped at
 * "100+" beyond. The 100 cap is the only boundary — no lower brackets exist.
 * Every public surface (pages, OGP, API) renders counts through this
 * function; unbounded exact counts stay operator-only.
 */

export const DISPLAY_CAP = 100;

export function displayValue(count: number): string {
	return count <= DISPLAY_CAP ? String(count) : `${DISPLAY_CAP}+`;
}

/**
 * A count clamped for shipping to the browser. Loader data is serialised into
 * the page HTML, so a raw sum there discloses the exact number the cap exists
 * to withhold — clamp before it leaves the worker, not at render time.
 *
 * The two counts of headroom keep the boundary honest under the optimistic
 * ±1 the page applies while a send is in flight: at a true 101 the clamp is a
 * no-op, and 102 still reads "100+" after a -1.
 */
export function clampForDisplay(count: number): number {
	return Math.min(count, DISPLAY_CAP + 2);
}
