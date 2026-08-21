// Self-serve subject creation, two steps by design: review freezes the input
// into a confirmation dialog (visibility choice, publication notice), and
// register — behind Turnstile — creates the page and lands on it. The created
// row stays in the local D1 — harmless seed noise.

import { en } from "../app/lib/i18n/en";
import { ja } from "../app/lib/i18n/ja";
import { expect, test } from "./fixtures";

test("review confirms the draft and register lands on the fresh page", async ({ page }) => {
	await page.goto("/ja/subjects/new");
	const name = `E2E作成テスト ${Date.now()}`;
	await page.getByLabel(ja.createNameLabel, { exact: true }).fill(name);
	await page.getByRole("button", { name: ja.createConfirm }).click();
	// The confirmation dialog carries the draft, the visibility pills, and the
	// publication notice — nothing was sent yet.
	const dialog = page.getByRole("dialog", { name: ja.createConfirmTitle });
	await expect(dialog).toBeVisible();
	await expect(dialog).toContainText(name);
	await expect(dialog).toContainText(ja.visibilityListed);
	await expect(dialog).toContainText(ja.createPublicNotice.slice(0, 12));
	await dialog.getByRole("button", { name: ja.createSubmit }).click();
	await expect(page).toHaveURL(/\/ja\/subjects\/[0-9a-f-]{36}$/);
	await expect(page.getByRole("heading", { level: 1 })).toHaveText(name);
});

test("the map mode reveals the location picker", async ({ page }) => {
	await page.goto("/ja/subjects/new");
	// Name mode is the default: no map on screen.
	await expect(page.getByLabel(ja.locationMapLabel)).toHaveCount(0);
	await page.getByText(ja.createModeMap).click();
	await expect(page.getByLabel(ja.locationMapLabel)).toBeVisible();
});

test("the form is localized", async ({ page }) => {
	await page.goto("/en/subjects/new");
	await expect(page.getByRole("heading", { level: 1 })).toHaveText(en.createTitle);
	await expect(page.getByLabel(en.createNameLabel, { exact: true })).toBeVisible();
});
