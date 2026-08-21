/**
 * Minimal geohash codec (encode + cell bounds + bbox covers).
 *
 * Written in-house instead of adding a dependency: the service only needs
 * the near-search bbox covers, which is ~80 lines.
 */

import type { BBox } from "~/lib/geo";

const BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz";

/** Precision 5 ≈ 4.9 × 4.9 km cells: near-search covers and the privacy quantization. */
const GEOHASH_PRECISION = 5;

export function encodeGeohash(lat: number, lng: number, precision = GEOHASH_PRECISION): string {
	let minLat = -90;
	let maxLat = 90;
	let minLng = -180;
	let maxLng = 180;
	let hash = "";
	let bits = 0;
	let value = 0;
	let evenBit = true;
	while (hash.length < precision) {
		if (evenBit) {
			const mid = (minLng + maxLng) / 2;
			value *= 2;
			if (lng >= mid) {
				value += 1;
				minLng = mid;
			} else {
				maxLng = mid;
			}
		} else {
			const mid = (minLat + maxLat) / 2;
			value *= 2;
			if (lat >= mid) {
				value += 1;
				minLat = mid;
			} else {
				maxLat = mid;
			}
		}
		evenBit = !evenBit;
		bits += 1;
		if (bits === 5) {
			hash += BASE32.charAt(value);
			bits = 0;
			value = 0;
		}
	}
	return hash;
}

export function geohashBounds(hash: string): BBox {
	let minLat = -90;
	let maxLat = 90;
	let minLng = -180;
	let maxLng = 180;
	let evenBit = true;
	for (const char of hash) {
		const value = BASE32.indexOf(char);
		if (value === -1) {
			throw new Error(`invalid geohash character: ${char}`);
		}
		for (let bit = 4; bit >= 0; bit -= 1) {
			const isSet = (value >> bit) & 1;
			if (evenBit) {
				const mid = (minLng + maxLng) / 2;
				if (isSet) {
					minLng = mid;
				} else {
					maxLng = mid;
				}
			} else {
				const mid = (minLat + maxLat) / 2;
				if (isSet) {
					minLat = mid;
				} else {
					maxLat = mid;
				}
			}
			evenBit = !evenBit;
		}
	}
	return { minLat, maxLat, minLng, maxLng };
}

/** Cell edge sizes in degrees per precision (lat, lng halve alternately). */
const CELL_DEGREES: Record<number, { lat: number; lng: number }> = {
	3: { lat: 180 / 2 ** 7, lng: 360 / 2 ** 8 },
	4: { lat: 180 / 2 ** 10, lng: 360 / 2 ** 10 },
	5: { lat: 180 / 2 ** 12, lng: 360 / 2 ** 13 },
};

/**
 * The geohash prefixes covering a bbox, at the coarsest precision that stays
 * within `maxCells` — the count is bounded by construction, which is what
 * lets D1 queries seek the geohash index instead of scanning a degree band.
 */
export function coveringCells(bbox: BBox, maxCells = 24): string[] {
	for (const precision of [5, 4, 3]) {
		const cell = CELL_DEGREES[precision] as { lat: number; lng: number };
		const rows = Math.floor(bbox.maxLat / cell.lat) - Math.floor(bbox.minLat / cell.lat) + 1;
		const columns = Math.floor(bbox.maxLng / cell.lng) - Math.floor(bbox.minLng / cell.lng) + 1;
		if (rows * columns > maxCells && precision > 3) {
			continue;
		}
		const cells = new Set<string>();
		for (let row = 0; row < rows && cells.size <= maxCells; row += 1) {
			for (let column = 0; column < columns && cells.size <= maxCells; column += 1) {
				const lat = Math.min(bbox.minLat + row * cell.lat, bbox.maxLat);
				const lng = Math.min(bbox.minLng + column * cell.lng, bbox.maxLng);
				cells.add(encodeGeohash(lat, lng, precision));
			}
		}
		if (cells.size <= maxCells) {
			return [...cells];
		}
	}
	// A bbox wider than maxCells precision-3 cells (continental): no cover.
	return [];
}
