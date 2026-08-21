// Free-text subject search on the home page: the box queries the local FTS;
// a miss offers the create page instead of pretending to be exhaustive.

import { ja } from "../app/lib/i18n/ja";
import { SEED_SUBJECT } from "../scripts/seed/seed-subject";
import { expect, test } from "./fixtures";

test("the home search box finds a subject by name", async ({ page }) => {
	await page.goto("/ja");
	await page.getByRole("searchbox", { name: ja.searchHeading }).fill(SEED_SUBJECT.name);
	await expect(page.locator(`a[href="/ja/subjects/${SEED_SUBJECT.id}"]`)).toBeVisible();
});

test("a two-character query finds a subject by name prefix", async ({ page }) => {
	await page.goto("/ja");
	await page.getByRole("searchbox", { name: ja.searchHeading }).fill(SEED_SUBJECT.name.slice(0, 2));
	await expect(page.locator(`a[href="/ja/subjects/${SEED_SUBJECT.id}"]`)).toBeVisible();
});

test("a miss shows the create call-to-action", async ({ page }) => {
	await page.goto("/ja");
	await page.getByRole("searchbox", { name: ja.searchHeading }).fill("存在しない名前XYZ");
	await expect(page.getByText(ja.searchNoHits)).toBeVisible();
	// exact: the hero CTA's longer label contains this one as a substring.
	await expect(page.getByRole("link", { name: ja.searchNoHitsCta, exact: true })).toHaveAttribute(
		"href",
		"/ja/subjects/new",
	);
});
