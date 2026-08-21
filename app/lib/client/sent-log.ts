// Device-local send log: one entry per subject, type, and day. Purely a UX
// hint (the server cookie is the enforced layer) — losing it costs nothing.

import { toIsoDate } from "~/lib/period";

/** Exported for the e2e specs, which seed entries exactly as this module writes them. */
export function sentLogKey(id: string, type: string): string {
	return `negirau:sent:${id}:${type}`;
}

export function alreadySentToday(id: string, type: string): boolean {
	try {
		return localStorage.getItem(sentLogKey(id, type)) === toIsoDate(new Date());
	} catch {
		return false;
	}
}

export function markSentToday(id: string, type: string): void {
	try {
		localStorage.setItem(sentLogKey(id, type), toIsoDate(new Date()));
	} catch {
		// storage unavailable (private mode): the server cookie still guards
	}
}

export function unmarkSentToday(id: string, type: string): void {
	try {
		localStorage.removeItem(sentLogKey(id, type));
	} catch {
		// nothing to release
	}
}
