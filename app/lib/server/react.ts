/**
 * Reaction write flow, framework-agnostic so tests can drive it directly:
 * kill switch → IP throttle → Turnstile → daily UPSERT. The cheap gates run
 * before the expensive external siteverify round trip.
 *
 * Undo runs the same cheap gates. It cannot demand a fresh Turnstile token
 * (the tap comes seconds after the send), and its voucher authorises a
 * decrement of a counter everyone shares — so without a throttle one voucher
 * would be replayable for its whole lifetime, draining the day to zero.
 */

import * as z from "zod";

import { toIsoDate } from "~/lib/dates";
import { REACTION_TYPES } from "~/lib/reactions";
import {
	consumeUndoReceipt,
	getActiveSubject,
	recordReaction,
	revokeReaction,
} from "~/lib/server/db";
import { rateLimitKeyForIp, refuseAnonymousWrite, underLimit } from "~/lib/server/rate-limit";
import { verifyTurnstileToken } from "~/lib/server/turnstile";
import { issueUndoToken, undoTokenHash, verifyUndoToken } from "~/lib/server/undo-token";

// The subject id rides the URL (/subjects/{id}/reactions), so the bodies
// carry only what the URL cannot.
export const reactBodySchema = z.object({
	type: z.enum(REACTION_TYPES),
	token: z.string().min(1),
});

export const undoBodySchema = z.object({
	type: z.enum(REACTION_TYPES),
	undo_token: z.string().min(1),
});

interface ReactDeps {
	env: Env;
	clientIp: string | undefined;
}

export type ReactResult =
	| { ok: true; undo_token: string }
	| { ok: false; status: number; error: string };

export type UndoResult =
	| { ok: true; status: 200; day: string }
	| { ok: false; status: number; error: string };

/** The per-IP-and-subject throttle both directions share. */
function underSubjectLimit(
	env: Env,
	ipKey: string | undefined,
	subjectRowid: number,
): Promise<boolean> {
	if (ipKey === undefined) {
		return Promise.resolve(true);
	}
	return underLimit(env.REACT_RATE_LIMIT_IP_SUBJECT, `${ipKey}:${subjectRowid}`);
}

export async function handleReact(
	deps: ReactDeps,
	id: string,
	body: z.infer<typeof reactBodySchema>,
): Promise<ReactResult> {
	const { env, clientIp } = deps;
	// The shared cheap gates (kill switch, then the pure-IP throttle) run first
	// so a flood never pays for a siteverify round trip.
	const refusal = await refuseAnonymousWrite(env, clientIp, "react", "reactions_disabled");
	if (refusal) {
		return { ok: false, ...refusal };
	}
	const ipKey = clientIp === undefined ? undefined : rateLimitKeyForIp(clientIp);
	// Independent: the external siteverify call and the subject lookup.
	const [verified, subject] = await Promise.all([
		verifyTurnstileToken(env.TURNSTILE_SECRET_KEY, body.token, clientIp),
		getActiveSubject(env.DB, id),
	]);
	if (!verified) {
		return { ok: false, status: 403, error: "verification_failed" };
	}
	// Quarantined subjects are invisible on every public surface, so they do
	// not accept reactions either.
	if (!subject) {
		return { ok: false, status: 404, error: "unknown_subject" };
	}
	if (!(await underSubjectLimit(env, ipKey, subject.rowid))) {
		return { ok: false, status: 429, error: "rate_limited" };
	}
	const day = toIsoDate(new Date());
	await recordReaction(env.DB, subject.rowid, body.type, day);
	const undoToken = await issueUndoToken(env.TURNSTILE_SECRET_KEY, {
		subjectId: subject.rowid,
		type: body.type,
		day,
	});
	return { ok: true, undo_token: undoToken };
}

export async function handleUndo(
	deps: ReactDeps,
	id: string,
	body: z.infer<typeof undoBodySchema>,
): Promise<UndoResult> {
	const { env, clientIp } = deps;
	const refusal = await refuseAnonymousWrite(env, clientIp, "undo", "reactions_disabled");
	if (refusal) {
		return { ok: false, ...refusal };
	}
	const subject = await getActiveSubject(env.DB, id);
	if (!subject) {
		return { ok: false, status: 404, error: "unknown_subject" };
	}
	const ipKey = clientIp === undefined ? undefined : rateLimitKeyForIp(clientIp);
	if (!(await underSubjectLimit(env, ipKey, subject.rowid))) {
		return { ok: false, status: 429, error: "rate_limited" };
	}
	// The voucher names the day it authorises; decrementing "today" would undo
	// the wrong row for a send that straddled UTC midnight.
	const verified = await verifyUndoToken(env.TURNSTILE_SECRET_KEY, body.undo_token, {
		subjectId: subject.rowid,
		type: body.type,
	});
	if (verified === undefined) {
		return { ok: false, status: 403, error: "invalid_undo_token" };
	}
	// One decrement per voucher: without this receipt a replay — a double-tap
	// racing the cookie release, or a resent request — would keep draining a
	// day counter that other people's sends share.
	const consumed = await consumeUndoReceipt(
		env.DB,
		await undoTokenHash(body.undo_token),
		new Date(verified.expiresAt).toISOString(),
	);
	if (!consumed) {
		return { ok: false, status: 409, error: "already_undone" };
	}
	await revokeReaction(env.DB, subject.rowid, body.type, verified.day);
	return { ok: true, status: 200, day: verified.day };
}
