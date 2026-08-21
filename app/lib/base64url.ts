/** Shared base64url transcoding (used by cursors and undo tokens). */

export function toBase64Url(bytes: Uint8Array): string {
	return btoa(String.fromCodePoint(...bytes))
		.replaceAll("+", "-")
		.replaceAll("/", "_")
		.replace(/=+$/, "");
}

export function fromBase64Url(value: string): Uint8Array {
	const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
	return Uint8Array.from(atob(base64), (c) => c.codePointAt(0) ?? 0);
}
