/** Small helpers shared by the server route handlers (framework-neutral). */

import { getActiveSubject } from "~/lib/server/db";
import type { SubjectRow } from "~/lib/server/db";

/** The visitor's IP as Cloudflare reports it (undefined outside the edge, e.g. tests). */
export function clientIp(request: Request): string | undefined {
	return request.headers.get("cf-connecting-ip") ?? undefined;
}

/** Escape a string for XML text/attribute contexts (feed, sitemap). */
export function escapeXml(value: string): string {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;");
}

/** Read one cookie from a request ('=' inside the value is preserved). */
export function cookieValue(request: Request, name: string): string | undefined {
	for (const part of (request.headers.get("cookie") ?? "").split(";")) {
		const [key, ...rest] = part.trim().split("=");
		if (key === name && rest.length > 0) {
			return rest.join("=");
		}
	}
	return undefined;
}

/** A publicly cacheable text response (same TTL at browser and CDN). */
export function cachedResponse(body: string, contentType: string, maxAgeS: number): Response {
	return new Response(body, {
		headers: {
			"content-type": contentType,
			"cache-control": `public, max-age=${maxAgeS}, s-maxage=${maxAgeS}`,
		},
	});
}

/** Parse a JSON body, tolerating absence and garbage (schemas judge validity). */
export async function jsonBody(request: Request): Promise<unknown> {
	return await request.json().catch(() => null);
}

/**
 * A first-party write response — never cacheable. Page routes with a public
 * headers() forward this cache-control so action responses stay uncached.
 */
export function actionJson(data: unknown, status = 200, headers: HeadersInit = {}): Response {
	return Response.json(data, { status, headers: { ...headers, "cache-control": "no-store" } });
}

/** A write flow's refusal, in the JSON shape the first-party clients expect. */
export function refusalResponse(refusal: { status: number; error: string }): Response {
	return actionJson({ error: refusal.error }, refusal.status);
}

/** The subject or a thrown plain-text 404 — the page/representation shape. */
export async function loadActiveSubject(db: D1Database, id: string): Promise<SubjectRow> {
	const subject = await getActiveSubject(db, id);
	if (!subject) {
		throw new Response("not found", { status: 404 });
	}
	return subject;
}

/** A public read API refusal, in the spec's error shape. */
export function apiError(status: number, error: string): Response {
	return Response.json({ error }, { status });
}

/**
 * The one page cache policy: ~5 min at browser and CDN — short enough that
 * HTML never outlives its fingerprinted assets across a deploy. Action
 * (write) responses stamp their own no-store, forwarded here because the
 * route's headers() would otherwise override it with the public policy.
 */
export function pageHeaders(args: { actionHeaders: Headers }): HeadersInit {
	return {
		"cache-control": args.actionHeaders.get("cache-control") ?? "public, max-age=300, s-maxage=300",
	};
}
