// Link-only subjects: the page answers to the URL, but no listing, search,
// or robots signal ever surfaces it. The row is created through the form
// rather than seeded, so the visibility opt-out is exercised end to end.

import { ja } from "../app/lib/i18n/ja";
import { expect, test } from "./fixtures";

test("an unlisted subject opens by link but never surfaces", async ({ page }) => {
	const name = `E2Eリンク限定 ${Date.now()}`;
	await page.goto("/ja/subjects/new");
	await page.getByLabel(ja.createNameLabel, { exact: true }).fill(name);
	await page.getByRole("button", { name: ja.createConfirm }).click();
	const dialog = page.getByRole("dialog", { name: ja.createConfirmTitle });
	// Exact: the hint paragraph below the pills repeats the same words.
	await dialog.getByText(ja.visibilityUnlisted, { exact: true }).click();
	await dialog.getByRole("button", { name: ja.createSubmit }).click();

	// Reachable directly, with the noindex signal for crawlers.
	await expect(page).toHaveURL(/\/ja\/subjects\/[0-9a-f-]{36}$/);
	const id = page.url().split("/").pop();
	await expect(page.getByRole("heading", { level: 1 })).toHaveText(name);
	await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex");
	// Absent from the /subjects listing...
	await page.goto("/ja/subjects");
	await expect(page.getByRole("heading", { level: 1 })).toHaveText(ja.subjectsTitle);
	await expect(page.locator(`a[href="/ja/subjects/${id}"]`)).toHaveCount(0);
	// ...and from search, even by its exact name.
	await page.getByRole("searchbox", { name: ja.searchHeading }).fill(name);
	await expect(page.getByText(ja.searchNoHits)).toBeVisible();
});
