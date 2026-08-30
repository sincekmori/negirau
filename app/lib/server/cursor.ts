/**
 * Opaque keyset-pagination cursors.
 *
 * Opaque by construction, not by convention: the payload is the last-seen
 * rowid, which the API deliberately keeps out of subject objects because it
 * leaks the creation order and roughly the total count. A cursor that merely
 * base64-encoded it would hand that back on the next page, so cursors are
 * sealed with AES-GCM — unreadable, and unforgeable in the same primitive.
 */

import { fromBase64Url, toBase64Url } from "~/lib/base64url";
import { perSecret } from "~/lib/server/derived-key";

const IV_BYTES = 12;
const encoder = new TextEncoder();

const sealKey = perSecret(async (secret) => {
	// The secret is an arbitrary-length string; hash it to exact key material.
	const material = await crypto.subtle.digest(
		"SHA-256",
		encoder.encode(`negirau-cursor:${secret}`),
	);
	return crypto.subtle.importKey("raw", material, { name: "AES-GCM" }, false, [
		"encrypt",
		"decrypt",
	]);
});

export async function encodeCursor(secret: string, id: number): Promise<string> {
	const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
	const key = await sealKey(secret);
	const sealed = await crypto.subtle.encrypt(
		{ name: "AES-GCM", iv },
		key,
		encoder.encode(String(id)) as Uint8Array<ArrayBuffer>,
	);
	const packed = new Uint8Array(IV_BYTES + sealed.byteLength);
	packed.set(iv);
	packed.set(new Uint8Array(sealed), IV_BYTES);
	return toBase64Url(packed);
}

export async function decodeCursor(secret: string, cursor: string): Promise<number | undefined> {
	try {
		const packed = fromBase64Url(cursor);
		if (packed.length <= IV_BYTES) {
			return undefined;
		}
		const key = await sealKey(secret);
		const opened = await crypto.subtle.decrypt(
			{ name: "AES-GCM", iv: packed.slice(0, IV_BYTES) },
			key,
			packed.slice(IV_BYTES) as Uint8Array<ArrayBuffer>,
		);
		const decoded = new TextDecoder().decode(opened);
		return /^\d+$/.test(decoded) ? Number(decoded) : undefined;
	} catch {
		// Malformed, truncated, or not sealed by us: all just "no such page".
		return undefined;
	}
}

/**
 * The one "limit + 1 probe" pager: callers fetch one row beyond the limit,
 * and this slices the page and mints the next cursor from the last row kept.
 */
export async function paginate<T extends { rowid: number }>(
	secret: string,
	rows: T[],
	limit: number,
): Promise<{ page: T[]; nextCursor: string | null }> {
	const page = rows.slice(0, limit);
	const last = page.at(-1);
	const more = rows.length > limit && last !== undefined;
	return {
		page,
		nextCursor: more ? await encodeCursor(secret, last.rowid) : null,
	};
}
