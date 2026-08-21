/**
 * Client-side share primitives: one clipboard policy and the native share
 * sheet. Service-specific share URLs are plain links built by the caller.
 */

/** The one clipboard write; false when the environment refuses. */
export async function copyText(text: string): Promise<boolean> {
	try {
		await navigator.clipboard.writeText(text);
		return true;
	} catch {
		return false;
	}
}

export function canShareNatively(): boolean {
	return typeof navigator !== "undefined" && typeof navigator.share === "function";
}

export async function shareNatively(text: string, url: string): Promise<void> {
	try {
		await navigator.share({ text, url });
	} catch {
		// dismissed the sheet: nothing to report
	}
}
