import { en } from "./en";
import { ja } from "./ja";
import type { Locale, Messages } from "./messages";

export { LOCALES } from "./messages";
export type { Locale, Messages } from "./messages";

/**
 * The one place the weekly headline sentence is composed — page markup, the
 * og:description, the OG image, and the feed all derive from the same parts.
 */
export function weeklyHeadline(m: Messages, totalValue: string | undefined): string {
	if (totalValue === undefined) {
		return m.weeklyHeadlineEmpty;
	}
	const { before, after } = m.weeklyHeadlineParts;
	return `${before}${totalValue}${after}`;
}

const CATALOG: Record<Locale, Messages> = { ja, en };

// Locale primitives (DEFAULT_LOCALE, isLocale) live in
// messages.ts so the worker entry can import them without the catalogs.
export { DEFAULT_LOCALE, isLocale } from "./messages";

/** BCP-47-style OG locale tags; typed so a new locale cannot be forgotten. */
export const OG_LOCALES: Record<Locale, string> = { ja: "ja_JP", en: "en_US" };

export function messages(locale: Locale): Messages {
	return CATALOG[locale];
}
