// The core loop, chat-style: pick an emoji from the picker, undo from the
// toast, chips carry the weekly counts, and the per-type-per-day guards hold.
// Tests that record a reaction undo it, so the local D1 counts stay put.

import type { Page } from "@playwright/test";

import { sentLogKey } from "../app/lib/client/sent-log";
import { ja } from "../app/lib/i18n/ja";
import { SEED_SUBJECT } from "../scripts/seed/seed-subject";
import { expect, test } from "./fixtures";

const SUBJECT = `/ja/subjects/${SEED_SUBJECT.id}`;

// data-reaction is the steady test hook: emoji glyphs are declared
// placeholders for a future illustration set.
const HEART_CHIP = 'button[data-reaction="heart"][aria-pressed]';
const HEART_PICK = '[role="menuitem"][data-reaction="heart"]';
// Scoped by data-reaction: other toggles (embed format pills) use aria-pressed too.
const SENT_CHIP = 'button[data-reaction][aria-pressed="true"]';

/**
 * Send a heart the way a visitor would: tap its chip when this week already
 * has hearts, otherwise pick it from the emoji picker. Controls are disabled
 * until hydration, so waiting for an enabled control replaces retry loops.
 */
async function sendHeart(page: Page): Promise<void> {
	const chip = page.locator(HEART_CHIP);
	if ((await chip.count()) > 0) {
		await expect(chip).toBeEnabled();
		await chip.click();
	} else {
		const trigger = page.getByRole("button", { name: ja.addReaction });
		await expect(trigger).toBeEnabled();
		await trigger.click();
		await page.locator(HEART_PICK).click();
	}
	await expect(page.locator(SENT_CHIP)).toBeVisible();
}

/** Chat-style undo: tapping the pressed chip takes the reaction back. */
async function undoLastReaction(page: Page): Promise<void> {
	await page.locator(SENT_CHIP).click();
	await expect(page.locator(SENT_CHIP)).not.toBeVisible();
}

test("picking an emoji sends a reaction and undo takes it back", async ({ page }) => {
	await page.goto(SUBJECT);
	await sendHeart(page);
	await undoLastReaction(page);
});

test("the sent log blocks that type for the day but leaves the others open", async ({ page }) => {
	// The log is device-side dedupe, so no real send is needed: seed the entry
	// exactly as markSentToday writes it and let the page consult it.
	await page.goto(SUBJECT);
	await page.evaluate(
		(key) => {
			localStorage.setItem(key, new Date().toISOString().slice(0, 10));
		},
		sentLogKey(SEED_SUBJECT.id, "heart"),
	);
	await page.reload();
	// The sent type shows as a pressed, disabled chip...
	const sentChip = page.locator(SENT_CHIP);
	await expect(sentChip).toBeVisible();
	await expect(sentChip).toBeDisabled();
	// ...while every other type is still available in the picker.
	const trigger = page.getByRole("button", { name: ja.addReaction });
	await expect(trigger).toBeEnabled();
	await trigger.click();
	await expect(page.locator('[role="menuitem"][data-reaction="like"]')).toBeVisible();
});

test("the dedupe cookie blocks a resend even without the device log", async ({ page }) => {
	await page.goto(SUBJECT);
	// Keep the undo voucher: the page loses it on reload, but the count cleanup
	// at the end needs it.
	const sent = page.waitForResponse("**/subjects/**/reactions");
	await sendHeart(page);
	const sentResponse = await sent;
	const { undo_token: undoToken } = (await sentResponse.json()) as { undo_token: string };
	await expect(page.locator(SENT_CHIP)).toBeVisible();
	// Wipe the device log: only the HttpOnly cookie remains.
	await page.evaluate(() => localStorage.clear());
	await page.reload();
	// The heart now shows as a plain countable chip; tapping it hits the server,
	// which answers 409, and the page settles into the already-sent state.
	const chip = page.locator(HEART_CHIP);
	await expect(chip).toBeEnabled();
	await chip.click();
	await expect(page.getByText(ja.sentAlreadyToday)).toBeVisible();
	// Cleanup: undo via the API so the local D1 count returns to its start.
	const undone = await page.request.delete(`/subjects/${SEED_SUBJECT.id}/reactions`, {
		data: { type: "heart", undo_token: undoToken },
	});
	expect(undone.ok()).toBe(true);
});

test("the share hub reaches the poster and opens the embed dialog", async ({ page }) => {
	await page.goto(SUBJECT);
	// The hub is the only route to both features; the non-modal menu must
	// hand off cleanly to a link navigation and to a modal Radix dialog.
	await page.getByRole("button", { name: ja.shareButton }).click();
	await page.getByRole("menuitem", { name: ja.printPoster }).click();
	await expect(page).toHaveURL(new RegExp(`/ja/subjects/${SEED_SUBJECT.id}/poster$`));
	await page.goBack();
	await page.getByRole("button", { name: ja.shareButton }).click();
	await page.getByRole("menuitem", { name: ja.embedSummary }).click();
	await expect(page.getByRole("dialog", { name: ja.embedSummary })).toBeVisible();
	await expect(page.getByRole("dialog").locator("code")).toContainText(
		`/subjects/${SEED_SUBJECT.id}`,
	);
});

test("the emoji pills retarget the on-page QR", async ({ page }) => {
	await page.goto(SUBJECT);
	const qr = page.locator("[data-qr-type]");
	await expect(qr).toHaveAttribute("data-qr-type", "heart");
	await page.getByRole("group", { name: ja.qrTypePickerLabel }).getByTitle("お茶").click();
	await expect(qr).toHaveAttribute("data-qr-type", "tea");
});

test("scanning the QR link auto-sends one heart", async ({ page }) => {
	await page.goto(`${SUBJECT}?send=heart`);
	// No tap: the client POST behind Turnstile fires on its own. The scanner
	// did nothing on the page, so the page answers with the emoji burst.
	await expect(page.locator(".send-burst")).toBeVisible();
	await expect(page.locator(SENT_CHIP)).toBeVisible();
	await undoLastReaction(page);
});
