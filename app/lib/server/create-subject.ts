/**
 * Subject creation flow: name in, subject out, no pre-screening. Turnstile
 * and rate limits are the gates; the creator's IP is stored with the row for
 * legal traceability only.
 */

import * as z from "zod";

import { SUBJECT_NAME_MAX } from "~/lib/api/constants";
import { createSubject } from "~/lib/server/db";
import type { SubjectRow } from "~/lib/server/db";
import { refuseAnonymousWrite } from "~/lib/server/rate-limit";
import { verifyTurnstileToken } from "~/lib/server/turnstile";

function absent(value: unknown): boolean {
	return value === null || value === undefined;
}

export const createBodySchema = z
	.object({
		name: z.string().trim().min(1).max(SUBJECT_NAME_MAX),
		lat: z.number().min(-90).max(90).nullish(),
		lng: z.number().min(-180).max(180).nullish(),
		/** false = link-only: off search and listings, reachable by URL. */
		listed: z.boolean().default(true),
		token: z.string().min(1),
	})
	.refine((body) => absent(body.lat) === absent(body.lng), {
		message: "lat and lng come together",
	});

export type CreateResult =
	| { ok: true; subject: SubjectRow }
	| { ok: false; status: number; error: string };

export async function handleCreate(
	env: Env,
	clientIp: string | undefined,
	body: z.infer<typeof createBodySchema>,
): Promise<CreateResult> {
	const refusal = await refuseAnonymousWrite(env, clientIp, "create", "creation_disabled");
	if (refusal) {
		return { ok: false, ...refusal };
	}
	if (!(await verifyTurnstileToken(env.TURNSTILE_SECRET_KEY, body.token, clientIp))) {
		return { ok: false, status: 403, error: "verification_failed" };
	}
	const subject = await createSubject(env.DB, {
		name: body.name,
		lat: body.lat ?? null,
		lng: body.lng ?? null,
		listed: body.listed,
		createdIp: clientIp ?? "unknown",
	});
	return { ok: true, subject };
}
