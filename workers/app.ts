/**
 * The Worker entry: everything that used to live in framework hooks — CORS
 * preflight, security headers, and locale resolution — wraps the React Router
 * request handler here, and loaders receive it all through a typed context.
 */

import { createRequestHandler, RouterContextProvider } from "react-router";

import { ROUTE_PREFIX } from "~/lib/api/constants";
import { appContext } from "~/lib/context";
import { isLocale, negotiateLocale } from "~/lib/i18n/messages";
import { nudgeOperator } from "~/lib/server/nudge";
import { cookieValue } from "~/lib/server/route-helpers";
import { siteOrigins } from "~/lib/site";
import type { SiteOrigins } from "~/lib/site";

const CORS_HEADERS = {
	"access-control-allow-origin": "*",
	"access-control-allow-methods": "GET, OPTIONS",
	"access-control-allow-headers": "content-type, if-none-match",
	"access-control-max-age": "86400",
};

const LOCALE_COOKIE = "negirau_lang";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

const requestHandler = createRequestHandler(
	() => import("virtual:react-router/server-build"),
	import.meta.env.MODE,
);

function stampHeaders(
	response: Response,
	site: SiteOrigins,
	origin: string,
	isPublicApi: boolean,
	localePrefixed: boolean,
): Response {
	// frame-ancestors 'none' blocks third-party pages from embedding us and
	// auto-firing QR-direct sends from an iframe.
	response.headers.set("content-security-policy", "frame-ancestors 'none'");
	if (origin !== site.canonical && origin !== site.api) {
		// The dev host serves the same content on a public URL; keep search
		// engines on the canonical domains only.
		response.headers.set("x-robots-tag", "noindex");
	}
	response.headers.set("x-content-type-options", "nosniff");
	response.headers.set("referrer-policy", "strict-origin-when-cross-origin");
	if (isPublicApi) {
		for (const [key, value] of Object.entries(CORS_HEADERS)) {
			response.headers.set(key, value);
		}
	} else if (!localePrefixed && response.status >= 300 && response.status < 400) {
		// Bare-path locale redirects depend on cookie/Accept-Language — never cache.
		response.headers.set("cache-control", "no-store");
	}
	return response;
}

export default {
	async fetch(request, env, ctx) {
		const url = new URL(request.url);
		// The icon is SVG-only, declared via <link>; answer the blind icon
		// probes (crawlers, feed readers, iOS) with a cheap cacheable miss
		// instead of letting them fall through to an SSR-rendered 404.
		if (url.pathname === "/favicon.ico" || url.pathname === "/apple-touch-icon.png") {
			return new Response(null, {
				status: 404,
				headers: { "cache-control": "public, max-age=86400, s-maxage=86400" },
			});
		}
		const site = siteOrigins(env.SITE_DOMAIN);
		const isPublicApi = url.pathname.startsWith(`${ROUTE_PREFIX}/`);
		if (isPublicApi && request.method === "OPTIONS") {
			return stampHeaders(
				new Response(null, { status: 204 }),
				site,
				url.origin,
				isPublicApi,
				false,
			);
		}
		const firstSegment = url.pathname.split("/")[1] ?? "";
		const localePrefixed = isLocale(firstSegment);
		const locale = localePrefixed
			? firstSegment
			: negotiateLocale(
					cookieValue(request, LOCALE_COOKIE),
					request.headers.get("accept-language"),
				);
		const context = new RouterContextProvider();
		context.set(appContext, { env, ctx, locale, site });
		const response = await requestHandler(request, context);
		// A mutable copy: the handler's response may have immutable headers.
		const stamped = stampHeaders(
			new Response(response.body, response),
			site,
			url.origin,
			isPublicApi,
			localePrefixed,
		);
		if (localePrefixed && cookieValue(request, LOCALE_COOKIE) !== locale) {
			// The visited language sticks, so bare links (shares, QR) reopen in
			// it. Only set when it changes: a Set-Cookie on every response would
			// make every page uncacheable by any shared cache.
			stamped.headers.append(
				"set-cookie",
				`${LOCALE_COOKIE}=${locale}; Path=/; Max-Age=${COOKIE_MAX_AGE}; HttpOnly; SameSite=Lax; Secure`,
			);
		}
		return stamped;
	},
	scheduled(_controller, env, ctx) {
		ctx.waitUntil(nudgeOperator(env));
	},
} satisfies ExportedHandler<Env>;
