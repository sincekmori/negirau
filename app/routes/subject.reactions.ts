// First-party reaction endpoint, addressed like the resource it touches:
// POST /subjects/{id}/reactions sends one, DELETE undoes one. Deliberately
// NOT part of the public v1 API: sending presumes a Turnstile-capable browser,
// and undoing presumes the signed voucher from a verified send.

import { appContext } from "~/lib/context";
import { toIsoDate } from "~/lib/period";
import { handleReact, handleUndo, reactBodySchema, undoBodySchema } from "~/lib/server/react";
import {
	actionJson,
	clientIp,
	cookieValue,
	jsonBody,
	refusalResponse,
} from "~/lib/server/route-helpers";
import {
	hasAnySent,
	hasSent,
	SENT_COOKIE,
	sentCookieHeader,
	withoutSent,
	withSent,
} from "~/lib/server/sent-cookie";

import type { Route } from "./+types/subject.reactions";

async function send(request: Request, env: Env, id: string): Promise<Response> {
	const parsed = reactBodySchema.safeParse(await jsonBody(request));
	if (!parsed.success) {
		return refusalResponse({ status: 400, error: "invalid_body" });
	}
	// Server-checked dedupe: one send per subject, type, and day — a reload
	// (or a cleared localStorage) cannot double-count.
	const sent = cookieValue(request, SENT_COOKIE);
	const day = toIsoDate(new Date());
	if (hasSent(sent, id, parsed.data.type, day)) {
		return refusalResponse({ status: 409, error: "already_sent" });
	}
	const result = await handleReact({ env, clientIp: clientIp(request) }, id, parsed.data);
	if (!result.ok) {
		return refusalResponse(result);
	}
	return actionJson({ ok: true, undo_token: result.undo_token }, 200, {
		"set-cookie": sentCookieHeader(withSent(sent, id, parsed.data.type, day)),
	});
}

async function undo(request: Request, env: Env, id: string): Promise<Response> {
	const parsed = undoBodySchema.safeParse(await jsonBody(request));
	if (!parsed.success) {
		return refusalResponse({ status: 400, error: "invalid_body" });
	}
	// The voucher says a send happened; the cookie says this client is the one
	// that made it and has not already taken the undo back.
	const sent = cookieValue(request, SENT_COOKIE);
	if (!hasAnySent(sent, id, parsed.data.type)) {
		return refusalResponse({ status: 409, error: "nothing_to_undo" });
	}
	const result = await handleUndo({ env, clientIp: clientIp(request) }, id, parsed.data);
	if (!result.ok) {
		return refusalResponse(result);
	}
	// Release the dedupe entry for the day the voucher actually undid: an
	// undone send may be redone.
	const released = withoutSent(sent, id, parsed.data.type, result.day);
	return actionJson({ ok: true }, 200, { "set-cookie": sentCookieHeader(released) });
}

export function action({ request, params, context }: Route.ActionArgs) {
	const { env } = context.get(appContext);
	if (request.method === "POST") {
		return send(request, env, params.id);
	}
	if (request.method === "DELETE") {
		return undo(request, env, params.id);
	}
	return refusalResponse({ status: 405, error: "method_not_allowed" });
}
