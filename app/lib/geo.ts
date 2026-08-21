/** Small spherical-geometry helpers shared by the near search (server and client). */

const EARTH_RADIUS_M = 6_371_000;

const toRad = (deg: number) => (deg * Math.PI) / 180;

export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
	const dLat = toRad(lat2 - lat1);
	const dLng = toRad(lng2 - lng1);
	const a =
		Math.sin(dLat / 2) ** 2 +
		Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
	return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

export interface BBox {
	minLng: number;
	minLat: number;
	maxLng: number;
	maxLat: number;
}

/** Parse a 'lat,lng' string with range checks; undefined when malformed. */
export function parseLatLng(value: string): { lat: number; lng: number } | undefined {
	const parts = value.split(",").map(Number);
	if (parts.length !== 2 || parts.some((n) => !Number.isFinite(n))) {
		return undefined;
	}
	const [lat, lng] = parts as [number, number];
	if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
		return undefined;
	}
	return { lat, lng };
}

/** Rough degree box around a point, for SQL prefiltering before exact haversine. */
export function boundingBoxAround(lat: number, lng: number, radiusMeters: number): BBox {
	const latDelta = (radiusMeters / EARTH_RADIUS_M) * (180 / Math.PI);
	const lngDelta = latDelta / Math.max(Math.cos((lat * Math.PI) / 180), 0.01);
	return {
		minLat: lat - latDelta,
		maxLat: lat + latDelta,
		minLng: lng - lngDelta,
		maxLng: lng + lngDelta,
	};
}

/** The one display form of a point (5 decimals ≈ 1 m), shared by picker and confirmations. */
export function formatLatLng(lat: number, lng: number): string {
	return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}
