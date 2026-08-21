// The subject page map. maplibre-gl v6 boots a web worker from a separate
// chunk; without it the canvas still appears but no tiles ever render, which
// is invisible to UI-state assertions. Waiting for the worker chunk response
// pins the regression directly. The map boots lazily, once scrolled near.

import { ja } from "../app/lib/i18n/ja";
import { SEED_SUBJECT } from "../scripts/seed/seed-subject";
import { expect, test } from "./fixtures";

test("the subject map boots lazily and loads its worker chunk from the build", async ({ page }) => {
	const workerChunk = page.waitForResponse((response) =>
		response.url().includes("maplibre-gl-worker"),
	);
	await page.goto(`/ja/subjects/${SEED_SUBJECT.id}`);
	expect(await page.locator(".maplibregl-canvas").count()).toBe(0);
	await page.getByRole("region", { name: ja.subjectMapLabel }).scrollIntoViewIfNeeded();
	await expect(page.locator(".maplibregl-canvas")).toBeVisible();
	const response = await workerChunk;
	expect(response.ok()).toBe(true);
});
