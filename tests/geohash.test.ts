import { describe, expect, it } from "vitest";

import { encodeGeohash, geohashBounds } from "~/lib/geohash";

describe("encodeGeohash", () => {
	it("matches the canonical reference example", () => {
		// The classic geohash example from the original specification.
		expect(encodeGeohash(42.605, -5.603, 5)).toBe("ezs42");
	});

	it("round-trips through its own cell bounds", () => {
		const hash = encodeGeohash(35.6466, 139.6532);
		const bounds = geohashBounds(hash);
		expect(
			encodeGeohash((bounds.minLat + bounds.maxLat) / 2, (bounds.minLng + bounds.maxLng) / 2),
		).toBe(hash);
	});
});

describe("geohashBounds", () => {
	it("rejects invalid characters", () => {
		expect(() => geohashBounds("ab!")).toThrow();
	});
});
