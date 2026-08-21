// The poster page: size and reaction type as URL-borne segmented controls,
// and a screen-fit preview that never overflows a phone.

import { ja } from "../app/lib/i18n/ja";
import { SEED_SUBJECT } from "../scripts/seed/seed-subject";
import { expect, test } from "./fixtures";

test("size and type pills switch the sheet and the printed QR", async ({ page }) => {
	await page.goto(`/ja/subjects/${SEED_SUBJECT.id}/poster`);
	await page.getByRole("link", { name: ja.posterSizeLabels.postcard }).click();
	await expect(page).toHaveURL(/size=postcard&type=heart/);
	await expect(page.locator(".poster-sheet.size-postcard")).toBeVisible();
	// Switching the reaction keeps the chosen size and re-encodes the QR.
	await page
		.getByRole("navigation", { name: ja.qrTypePickerLabel })
		.getByTitle(ja.reactionLabels.tea)
		.click();
	await expect(page).toHaveURL(/size=postcard&type=tea/);
	await expect(page.locator(".poster-sheet.size-postcard")).toBeVisible();
});

test("the sheet scales into a phone viewport instead of overflowing", async ({ page }) => {
	await page.setViewportSize({ width: 375, height: 812 });
	await page.goto(`/ja/subjects/${SEED_SUBJECT.id}/poster`);
	await expect(page.locator(".poster-sheet")).toBeVisible();
	// The fit runs client-side after hydration (zoom starts at 1); measuring
	// before it lands would report the unscaled sheet.
	await expect(page.locator(".poster-sheet")).not.toHaveCSS("zoom", "1");
	const overflow = await page.evaluate(
		() => document.documentElement.scrollWidth > window.innerWidth,
	);
	expect(overflow).toBe(false);
	const width = await page
		.locator(".poster-sheet")
		.evaluate((sheet) => sheet.getBoundingClientRect().width);
	expect(width).toBeLessThanOrEqual(375);
});
