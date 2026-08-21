/**
 * The complete UI vocabulary. Every locale implements this single interface,
 * so adding a string or a reaction type breaks the build until every locale
 * covers it.
 */

import type { PosterSize } from "~/lib/poster";
import type { ReactionType } from "~/lib/reactions";

export const LOCALES = ["ja", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

export function isLocale(value: string): value is Locale {
	return (LOCALES as readonly string[]).includes(value);
}

/**
 * Cookie first (an explicit choice sticks), then Accept-Language, then the
 * default. Catalog-free on purpose: the worker entry runs this on every
 * request and must not drag both message catalogs into its startup graph.
 */
export function negotiateLocale(
	cookieLocale: string | undefined,
	acceptLanguage: string | null,
): Locale {
	if (cookieLocale !== undefined && isLocale(cookieLocale)) {
		return cookieLocale;
	}
	for (const part of (acceptLanguage ?? "").split(",")) {
		const tag = (part.split(";")[0] ?? "").trim().toLowerCase().slice(0, 2);
		if (isLocale(tag)) {
			return tag;
		}
	}
	return DEFAULT_LOCALE;
}

interface HowStep {
	title: string;
	body: string;
}

export interface PolicySection {
	title: string;
	body: string;
}

export interface Messages {
	// Layout
	navCreate: string;
	navContact: string;
	footerTagline: string;
	switchLocaleLabel: string;
	themeLabel: string;
	themeSystem: string;
	themeLight: string;
	themeDark: string;

	// Top page
	topTitle: string;
	topDescription: string;
	heroTitle: string;
	heroBody: string;
	heroCtaCreate: string;
	heroCtaNearby: string;
	recentHeading: string;
	recentEmpty: string;
	howHeading: string;
	howSteps: [HowStep, HowStep, HowStep];
	devHeading: string;
	devBody: string;
	devSpecLabel: string;
	devPageLinkLabel: string;

	// Developers page
	devPageTitle: string;
	devPageIntro: string;
	devApiHeading: string;
	devApiBody: string;
	devLlmsBody: string;
	// Localized one-liners keyed by API operationId; a missing key falls back
	// to the manifest's English summary, so the page never breaks on a new
	// operation — it just shows English until translated.
	devEndpointSummaries: Readonly<Record<string, string>>;
	devClientsHeading: string;
	devClientsBody: string;
	devMcpHeading: string;
	devMcpBody: string;
	devSkillHeading: string;
	devSkillBody: string;
	devGithubLabel: string;

	// Subjects listing page
	subjectsTitle: string;
	subjectsIntro: string;
	subjectsMore: string;
	subjectsAllLink: string;

	// Search
	searchHeading: string;
	searchPlaceholder: string;
	searchNoHits: string;
	searchNoHitsCta: string;
	searchFailed: string;

	// Nearby finder
	nearbyHeading: string;
	nearbyPrivacyNote: string;
	nearbyButton: string;
	nearbySearching: string;
	nearbyNoGeolocation: string;
	nearbyDataUnavailable: string;
	nearbyPositionFailed: string;
	nearbyNoHits: string;

	// Subject page
	/** Headline when nothing has been sent yet. */
	weeklyHeadlineEmpty: string;
	/**
	 * The headline, split around the highlighted value so markup can
	 * emphasize it. The plain-string form is derived once in ~/lib/i18n's
	 * weeklyHeadline() — never spell the sentence out a second time.
	 */
	weeklyHeadlineParts: { before: string; after: string };
	/** Accessible names for the emoji buttons (a11y), never visible captions. */
	reactionLabels: Record<ReactionType, string>;
	addReaction: string;
	/** Title of a pressed chip while its undo voucher is still valid. */
	undoHint: string;
	/** Announced to screen readers when a QR-triggered send lands. */
	sentAnnounce: string;
	/** Static invitation beside the picker when the week holds nothing yet. */
	reactionInvite: string;
	shareButton: string;
	shareNative: string;
	shareCopyLink: string;
	/** Prefilled post text for share intents. */
	shareText: (name: string) => string;
	sentAlreadyToday: string;
	noticeRateLimited: string;
	noticeSendFailed: string;
	noticeNetworkFailed: string;
	copiedAnnounce: string;
	/** The collapsed embeds section — phrased for non-engineers, never "badge". */
	embedSummary: string;
	embedFormatLabel: string;
	copyButton: string;
	printPoster: string;
	/** Group label for the emoji pills that pick which reaction a QR sends. */
	qrTypePickerLabel: string;
	/** Caption under the QR naming what a scan sends, e.g. 「❤️を送る」. */
	sendVerb: (emoji: string) => string;
	posterSizePickerLabel: string;
	subjectMapLabel: string;
	/** Link to the edit page, where a fix or a deletion is requested. */
	subjectReportLink: string;
	ogTitle: (subjectName: string) => string;

	// Poster page
	posterPageTitle: (subjectName: string) => string;
	posterInstruction: string;
	posterPrintButton: string;
	posterLead: string;
	posterHint: string;
	posterSizeLabels: Record<PosterSize, string>;
	/** Breadcrumb leaf on the poster page: {subject.name} > this. */
	posterCrumb: string;

	// Creation form
	createTitle: string;
	createIntro: string;
	createNameLabel: string;
	/** Group label for the input-method pills (type a name / pick from map). */
	createModeLegend: string;
	createModeName: string;
	createModeMap: string;
	createNamePlaceholder: string;
	locationSearchPlaceholder: string;
	locationHint: string;
	locationMapLabel: string;
	locationUseCurrent: string;
	locationClear: string;
	locationSearchFailed: string;
	/** Title of the confirmation dialog before registering. */
	createConfirmTitle: string;
	/** The form's step-1 button: review the input, register comes later. */
	createConfirm: string;
	createLocationLabel: string;
	locationNone: string;
	createVisibilityLegend: string;
	visibilityListed: string;
	visibilityUnlisted: string;
	visibilityUnlistedHint: string;
	createSubmit: string;
	createFailed: string;
	createPublicNotice: string;

	// Edit page (update/delete requests)
	editTitle: string;
	editIntro: string;
	editConfirmTitle: string;
	editSubmit: string;
	editRequested: string;
	editBackToPage: string;
	deleteHeading: string;
	deleteBody: string;
	deleteButton: string;
	deleteConfirmTitle: string;
	requestFailed: string;

	// Contact page
	contactTitle: string;
	contactBody: string;
	contactCta: string;
	contactMailSubject: string;

	// Privacy policy page (sections live in ~/lib/i18n/policies — they ride
	// only the /privacy and /terms route chunks, not every page).
	privacyTitle: string;

	/** Badge value suffixes (週/wk …); all-time deliberately has none. */
	badgePeriodSuffix: { week: string; month: string; year: string };

	// Terms of service page
	termsTitle: string;
}
