// The developers page: reachable from the home dev section, and the copy
// button actually lands the command on the clipboard.

import { ja } from "../app/lib/i18n/ja";
import { expect, test } from "./fixtures";

test("home links to the developers page and its copy button works", async ({ page, context }) => {
	await context.grantPermissions(["clipboard-read", "clipboard-write"]);
	await page.goto("/ja");
	await page.getByRole("link", { name: ja.devPageLinkLabel }).click();
	await expect(page).toHaveURL("/ja/developers");
	await expect(page.getByRole("heading", { level: 1 })).toHaveText(ja.devPageTitle);
	// The skill install command is the last block; copy it and read it back.
	await page.getByRole("button", { name: ja.copyButton }).last().click();
	await expect
		.poll(() => page.evaluate(() => navigator.clipboard.readText()))
		.toContain("npx skills add sincekmori/negirau");
});
