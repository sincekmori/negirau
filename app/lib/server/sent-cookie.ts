/**
 * Server-checked "one send per subject, type, and day" dedupe:
 * an HttpOnly cookie listing recent id:type@day sends. It survives localStorage
 * clears and page reloads, carries no identifiers (zero-personal-data), and is
 * deliberately only a speed bump — Turnstile and rate limits are the walls.
 */

export const SENT_COOKIE = "negirau_sent";

/** Bounded so the header stays small; oldest entries fall off. */
const MAX_ENTRIES = 20;
const COOKIE_MAX_AGE_S = 60 * 60 * 24;

function entry(id: string, type: string, day: string): string {
	return `${id}:${type}@${day}`;
}

function parseEntries(cookieValue: string | undefined): string[] {
	if (cookieValue === undefined || cookieValue === "") {
		return [];
	}
	return decodeURIComponent(cookieValue).split(",").filter(Boolean);
}

export function hasSent(
	cookieValue: string | undefined,
	id: string,
	type: string,
	day: string,
): boolean {
	return parseEntries(cookieValue).includes(entry(id, type, day));
}

/**
 * Whether this client still holds an unreleased send of this type, on any
 * day. Undo requires it: the voucher proves a send happened, this proves the
 * caller is the browser that made it and has not already taken its undo back.
 */
export function hasAnySent(cookieValue: string | undefined, id: string, type: string): boolean {
	return parseEntries(cookieValue).some((existing) => existing.startsWith(`${id}:${type}@`));
}

export function withSent(
	cookieValue: string | undefined,
	id: string,
	type: string,
	day: string,
): string {
	const entries = parseEntries(cookieValue).filter((existing) => existing !== entry(id, type, day));
	entries.push(entry(id, type, day));
	return entries.slice(-MAX_ENTRIES).join(",");
}

export function withoutSent(
	cookieValue: string | undefined,
	id: string,
	type: string,
	day: string,
): string {
	return parseEntries(cookieValue)
		.filter((existing) => existing !== entry(id, type, day))
		.join(",");
}

export function sentCookieHeader(value: string): string {
	// Path tracks the /subjects tree in app/routes.ts (cookie paths cannot
	// name /subjects/:id/reactions precisely); rename them in lockstep.
	return `${SENT_COOKIE}=${encodeURIComponent(value)}; Path=/subjects; Max-Age=${COOKIE_MAX_AGE_S}; HttpOnly; SameSite=Lax; Secure`;
}
