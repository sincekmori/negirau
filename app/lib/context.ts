/**
 * The typed request context (react-router v8 createContext): the Worker entry
 * fills it once per request; loaders and actions read it with context.get().
 */

import { createContext } from "react-router";

import type { Locale } from "~/lib/i18n";
import type { SiteOrigins } from "~/lib/site";

export interface AppContext {
	env: Env;
	ctx: ExecutionContext;
	/** Resolved locale: URL path prefix → cookie → Accept-Language → en. */
	locale: Locale;
	/** Origins derived from env.SITE_DOMAIN (app/lib/site.ts). */
	site: SiteOrigins;
}

export const appContext = createContext<AppContext>();
