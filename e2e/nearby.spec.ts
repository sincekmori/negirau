// GPS nearby search: the position stays on the device; hits come from
// the near API queried at a coarse geohash-cell center.

import { ja } from "../app/lib/i18n/ja";
import { SEED_SUBJECT } from "../scripts/seed/seed-subject";
import { expect, test } from "./fixtures";

test.use({
	// Beside the seeded station.
	geolocation: { latitude: SEED_SUBJECT.lat, longitude: SEED_SUBJECT.lng },
	permissions: ["geolocation"],
});

test("searching from the current position lists seeded neighbors, nearest first", async ({
	page,
}) => {
	await page.goto("/ja");
	// The privacy invariant is asserted for real: no request may carry the position.
	const requested: string[] = [];
	page.on("request", (request) => requested.push(request.url()));
	const nearby = page.locator("#nearby");
	await nearby.getByRole("button", { name: ja.nearbyButton }).click();
	const first = nearby.getByRole("listitem").first();
	await expect(first.getByRole("link", { name: SEED_SUBJECT.name })).toBeVisible();
	await expect(first.getByText(/\dm|\d\.\dkm/)).toBeVisible();
	const latFragment = String(SEED_SUBJECT.lat).slice(0, 6);
	expect(requested.filter((url) => url.includes(latFragment))).toEqual([]);
});
