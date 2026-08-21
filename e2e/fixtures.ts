// Shared test base with a static-asset integrity guard: any same-origin
// asset request (script, stylesheet, worker, image…) answered with 4xx/5xx,
// or any uncaught page exception, fails the test that triggered it. UI-state
// assertions sail right past "the build forgot a file" bugs — the maplibre v6
// worker 404 shipped exactly that way — so the guard watches the layer where
// they actually happen. API calls (fetch/xhr) and document navigations are
// exempt: specs assert those statuses deliberately (409 dedupe, 404 page).

import { expect, test as base } from "@playwright/test";

export { expect } from "@playwright/test";

const GUARDED_RESOURCE_TYPES = new Set([
	"script",
	"stylesheet",
	"font",
	"image",
	"media",
	"worker",
	"other",
]);

export const test = base.extend<{ assetGuard: undefined }>({
	assetGuard: [
		async ({ page, baseURL }, use) => {
			const failures: string[] = [];
			page.on("response", (response) => {
				const type = response.request().resourceType();
				const sameOrigin = baseURL !== undefined && response.url().startsWith(baseURL);
				if (sameOrigin && GUARDED_RESOURCE_TYPES.has(type) && response.status() >= 400) {
					failures.push(`${response.status()} ${type} ${response.url()}`);
				}
			});
			page.on("pageerror", (error) => {
				failures.push(`uncaught exception: ${error.message}`);
			});
			await use(undefined);
			expect(failures, "same-origin asset failures and uncaught exceptions").toEqual([]);
		},
		{ auto: true },
	],
});
