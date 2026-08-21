// The shell: locale negotiation, the language switch, the theme menu, 404.

import { en } from "../app/lib/i18n/en";
import { ja } from "../app/lib/i18n/ja";
import { SEED_SUBJECT } from "../scripts/seed/seed-subject";
import { expect, test } from "./fixtures";

test.describe("locale negotiation", () => {
	test.use({ locale: "ja-JP" });

	test("a bare path redirects to the browser language and the choice sticks", async ({ page }) => {
		await page.goto("/");
		await expect(page).toHaveURL("/ja");
		// Visiting the other locale re-pins the cookie; bare paths follow it.
		await page.goto("/en");
		await page.goto("/");
		await expect(page).toHaveURL("/en");
	});

	test("a bare subject link (QR, share) lands on the localized page", async ({ page }) => {
		await page.goto(`/subjects/${SEED_SUBJECT.id}`);
		await expect(page).toHaveURL(`/ja/subjects/${SEED_SUBJECT.id}`);
		await expect(page.getByRole("heading", { level: 1 })).toHaveText(SEED_SUBJECT.name);
	});
});

test("the language switch swaps the prefix and the document language", async ({ page }) => {
	await page.goto("/ja");
	await expect(page.locator("html")).toHaveAttribute("lang", "ja");
	await page.getByRole("navigation").getByRole("link", { name: ja.switchLocaleLabel }).click();
	await expect(page).toHaveURL("/en");
	await expect(page.locator("html")).toHaveAttribute("lang", "en");
	await expect(page.getByRole("heading", { level: 1 })).toContainText(
		en.heroTitle.split("\n")[0] ?? "",
	);
});

test("the theme menu switches to dark and the choice survives a reload", async ({ page }) => {
	await page.goto("/en");
	await page.getByRole("button", { name: en.themeLabel }).click();
	await page.getByRole("menuitemradio", { name: en.themeDark }).click();
	await expect(page.locator("html")).toHaveClass(/dark/);
	await page.reload();
	await expect(page.locator("html")).toHaveClass(/dark/);
});

test("links styled as buttons carry no underline", async ({ page }) => {
	// The base stylesheet underlines anchors except those stamped
	// data-slot="button" by shadcn's Button asChild — the tripwire if the
	// vendored component ever stops stamping it.
	await page.goto("/ja");
	const cta = page.getByRole("link", { name: ja.heroCtaCreate });
	await expect(cta).toHaveAttribute("data-slot", "button");
	await expect(cta).toHaveCSS("text-decoration-line", "none");
});

test("unknown paths 404", async ({ page }) => {
	const response = await page.goto("/en/no-such-page");
	expect(response?.status()).toBe(404);
});
