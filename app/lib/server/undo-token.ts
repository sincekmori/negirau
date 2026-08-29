/**
 * Short-lived signed undo vouchers.
 *
 * A fresh Turnstile token cannot be demanded for an undo issued seconds after
 * the send, so the send response carries an HMAC voucher scoped to exactly
 * one (subject, type, day) decrement and expiring in seconds.
 *
 * The day rides inside the token rather than being recomputed at verify time:
 * a send at 23:59:58Z must still be undoable at 00:00:01Z, and the decrement
 * has to land on the day the increment actually hit. It is covered by the
 * signature, so it names a day we issued and no other.
 */

import { fromBase64Url, toBase64Url } from "~/lib/base64url";
import { perSecret } from "~/lib/derived-key";
import { UNDO_WINDOW_MS } from "~/lib/reactions";

const encoder = new TextEncoder();

const hmacKey = perSecret((secret) =>
	crypto.subtle.importKey(
		"raw",
		encoder.encode(`negirau-undo:${secret}`),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign", "verify"],
	),
);

interface UndoScope {
	subjectId: number;
	type: string;
	day: string;
}

function payload(scope: UndoScope, expiresAt: number): Uint8Array<ArrayBuffer> {
	const { subjectId, type, day } = scope;
	// The cast reconciles the DOM and Workers TextEncoder typings (ArrayBufferLike vs ArrayBuffer).
	return encoder.encode(`${subjectId}:${type}:${day}:${expiresAt}`) as Uint8Array<ArrayBuffer>;
}

export async function issueUndoToken(secret: string, scope: UndoScope): Promise<string> {
	const expiresAt = Date.now() + UNDO_WINDOW_MS;
	const key = await hmacKey(secret);
	const signature = await crypto.subtle.sign("HMAC", key, payload(scope, expiresAt));
	return `${expiresAt}.${scope.day}.${toBase64Url(new Uint8Array(signature))}`;
}

/**
 * The day the voucher authorises, or undefined when it does not verify.
 * Callers decrement that day — never one read from the clock.
 */
export async function verifyUndoToken(
	secret: string,
	token: string,
	scope: Omit<UndoScope, "day">,
): Promise<string | undefined> {
	const [expiresPart, day, signaturePart] = token.split(".");
	if (expiresPart === undefined || day === undefined || signaturePart === undefined) {
		return undefined;
	}
	const expiresAt = Number(expiresPart);
	if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) {
		return undefined;
	}
	let signature: Uint8Array;
	try {
		signature = fromBase64Url(signaturePart);
	} catch {
		// A malformed signature is simply not a valid voucher.
		return undefined;
	}
	const key = await hmacKey(secret);
	// subtle.verify over a hand-rolled compare: the platform's own comparison
	// does not leak the position of the first differing byte.
	const valid = await crypto.subtle.verify(
		"HMAC",
		key,
		signature as unknown as ArrayBufferView<ArrayBuffer>,
		payload({ ...scope, day }, expiresAt),
	);
	return valid ? day : undefined;
}
