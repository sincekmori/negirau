/**
 * Update/delete request flow: nothing changes immediately. With no accounts
 * there is no one to authorize an edit, so requests queue in subject_requests
 * for the operator's daily review — the same gates as every anonymous write
 * (kill switch → IP throttle → Turnstile) keep the queue from being flooded,
 * and the cheap gates run before the external siteverify round trip.
 */

import * as z from "zod";

import { SUBJECT_NAME_MAX } from "~/lib/api/constants";
import { getActiveSubject, upsertSubjectRequest } from "~/lib/server/db";
import { refuseAnonymousWrite } from "~/lib/server/rate-limit";
import { verifyTurnstileToken } from "~/lib/server/turnstile";

const updateRequestSchema = z.object({
	name: z.string().trim().min(1).max(SUBJECT_NAME_MAX),
	/** false = link-only: off search and listings, reachable by URL. */
	listed: z.boolean(),
	token: z.string().min(1),
});

const deleteRequestSchema = z.object({
	token: z.string().min(1),
});

export type RequestResult = { ok: true } | { ok: false; status: number; error: string };

/** Per-kind body → the token plus the queue payload (update carries one, delete none). */
function parseRequestBody(
	kind: "update" | "delete",
	body: unknown,
): { token: string; payload: string | null } | undefined {
	if (kind === "update") {
		const parsed = updateRequestSchema.safeParse(body);
		if (!parsed.success) {
			return undefined;
		}
		const { name, listed, token } = parsed.data;
		return { token, payload: JSON.stringify({ name, listed }) };
	}
	const parsed = deleteRequestSchema.safeParse(body);
	return parsed.success ? { token: parsed.data.token, payload: null } : undefined;
}

/** Method → queued request: PATCH files an update, DELETE files a deletion. */
export async function handleSubjectRequest(
	env: Env,
	clientIp: string | undefined,
	subjectId: string,
	method: string,
	body: unknown,
): Promise<RequestResult> {
	if (method !== "PATCH" && method !== "DELETE") {
		return { ok: false, status: 405, error: "method_not_allowed" };
	}
	const kind = method === "PATCH" ? "update" : "delete";
	const parsed = parseRequestBody(kind, body);
	if (!parsed) {
		return { ok: false, status: 400, error: "invalid_body" };
	}
	const refusal = await refuseAnonymousWrite(env, clientIp, "request", "requests_disabled");
	if (refusal) {
		return { ok: false, ...refusal };
	}
	// Independent: the external siteverify call and the subject lookup.
	const [verified, subject] = await Promise.all([
		verifyTurnstileToken(env.TURNSTILE_SECRET_KEY, parsed.token, clientIp),
		getActiveSubject(env.DB, subjectId),
	]);
	if (!verified) {
		return { ok: false, status: 403, error: "verification_failed" };
	}
	if (!subject) {
		return { ok: false, status: 404, error: "not_found" };
	}
	await upsertSubjectRequest(env.DB, subject.rowid, kind, parsed.payload);
	return { ok: true };
}
