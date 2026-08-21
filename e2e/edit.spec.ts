// The edit page queues update/delete REQUESTS (nothing mutates): review →
// confirm dialog → send → acknowledgement. Requests land in subject_requests
// in the local D1 — harmless seed noise, and the subject itself never changes.

import { ja } from "../app/lib/i18n/ja";
import { SEED_SUBJECT } from "../scripts/seed/seed-subject";
import { expect, test } from "./fixtures";

test("an update request is confirmed and acknowledged", async ({ page }) => {
	await page.goto(`/ja/subjects/${SEED_SUBJECT.id}/edit`);
	const name = `修正依頼テスト ${Date.now()}`;
	await page.getByLabel(ja.createNameLabel, { exact: true }).fill(name);
	await page.getByRole("button", { name: ja.createConfirm }).click();
	const dialog = page.getByRole("dialog", { name: ja.editConfirmTitle });
	await expect(dialog).toBeVisible();
	await expect(dialog).toContainText(name);
	await dialog.getByRole("button", { name: ja.editSubmit }).click();
	await expect(dialog).toContainText(ja.editRequested);
	// The subject itself is untouched: a request queued, not an edit applied.
	await dialog.getByRole("button", { name: ja.editBackToPage }).click();
	await expect(page).toHaveURL(`/ja/subjects/${SEED_SUBJECT.id}`);
	await expect(page.getByRole("heading", { level: 1 })).toHaveText(SEED_SUBJECT.name);
});

test("a deletion request has its own confirmation", async ({ page }) => {
	await page.goto(`/ja/subjects/${SEED_SUBJECT.id}/edit`);
	await page.getByRole("button", { name: ja.deleteButton }).click();
	const dialog = page.getByRole("dialog", { name: ja.deleteConfirmTitle });
	await expect(dialog).toBeVisible();
	await dialog.getByRole("button", { name: ja.editSubmit }).click();
	await expect(dialog).toContainText(ja.editRequested);
});

test("the subject page links to the edit page", async ({ page }) => {
	await page.goto(`/ja/subjects/${SEED_SUBJECT.id}`);
	await page.getByRole("link", { name: ja.subjectReportLink }).click();
	await expect(page).toHaveURL(`/ja/subjects/${SEED_SUBJECT.id}/edit`);
	await expect(page.getByRole("heading", { level: 1 })).toHaveText(ja.editTitle);
});
