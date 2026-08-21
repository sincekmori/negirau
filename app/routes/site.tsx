// The locale-scoped shell: header, footer, hreflang/OG site metadata, and the
// bare-path redirect. Pages under it are always served at /ja/... or /en/....
import { CirclePlus } from "lucide-react";
import { Link, Outlet, redirect, useLocation } from "react-router";

import { BrandIcon } from "~/lib/components/BrandIcon";
import { ThemeToggle } from "~/lib/components/ThemeToggle";
import { appContext } from "~/lib/context";
import { isLocale, LOCALES, messages, OG_LOCALES } from "~/lib/i18n";

import type { Route } from "./+types/site";

export function loader({ context, request, params }: Route.LoaderArgs) {
	const { env, locale, site } = context.get(appContext);
	if (params.locale === undefined) {
		// Bare paths — shares, printed QR codes, old bookmarks — go to the
		// visitor's negotiated locale (resolved in the worker entry).
		const url = new URL(request.url);
		const prefixed = url.pathname === "/" ? `/${locale}` : `/${locale}${url.pathname}`;
		throw redirect(`${prefixed}${url.search}`);
	}
	if (!isLocale(params.locale)) {
		// :locale? has no matcher; anything else in that segment is a plain 404.
		throw new Response("not found", { status: 404 });
	}
	return {
		locale,
		canonicalOrigin: site.canonical,
		// The operator's name is site identity, so it rides wrangler vars —
		// a self-hosting fork changes it without touching source.
		copyright: `© ${new Date().getFullYear()} ${env.COPYRIGHT_HOLDER}`,
	};
}

export default function Site({ loaderData }: Route.ComponentProps) {
	const { locale, canonicalOrigin, copyright } = loaderData;
	const m = messages(locale);
	const otherLocale = LOCALES.find((candidate) => candidate !== locale) ?? locale;
	const { pathname, search } = useLocation();
	// Pages are always locale-prefixed here (the loader guarantees it), so the
	// bare path is simply everything after the prefix.
	const barePath = pathname.slice(1 + locale.length);
	return (
		<>
			<link rel="canonical" href={`${canonicalOrigin}${pathname}`} />
			{LOCALES.map((candidate) => (
				<link
					key={candidate}
					rel="alternate"
					hrefLang={candidate}
					href={`${canonicalOrigin}/${candidate}${barePath}`}
				/>
			))}
			<link rel="alternate" hrefLang="x-default" href={`${canonicalOrigin}${barePath || "/"}`} />
			<meta property="og:site_name" content="Negirau" />
			<meta property="og:type" content="website" />
			<meta property="og:locale" content={OG_LOCALES[locale]} />
			<meta property="og:locale:alternate" content={OG_LOCALES[otherLocale]} />
			<header className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-6 pt-6">
				<Link
					to={`/${locale}`}
					className="text-brand-deep inline-flex items-center gap-2 text-[1.05rem] font-medium tracking-wide no-underline"
				>
					<BrandIcon size={22} />
					<span>Negirau</span>
				</Link>
				<nav className="flex items-center gap-5 text-[0.85rem]">
					{/* Same icon as every "add" action, so the nav link reads as one. */}
					<Link
						to={`/${locale}/subjects/new`}
						className="text-ink-soft hover:text-ink inline-flex items-center gap-1 whitespace-nowrap no-underline"
					>
						<CirclePlus aria-hidden="true" className="size-4" />
						{m.navCreate}
					</Link>
					<a
						href={`/${otherLocale}${barePath}${search}`}
						lang={otherLocale}
						hrefLang={otherLocale}
						className="text-ink-soft hover:text-ink whitespace-nowrap no-underline"
					>
						{m.switchLocaleLabel}
					</a>
					<ThemeToggle locale={locale} />
				</nav>
			</header>
			{/* pt-8 keeps the site header visibly apart from every page's title —
			    wider than the title→content gaps below it, so grouping reads
			    right. The home hero subtracts it from its own clamp. */}
			<main className="mx-auto max-w-3xl px-6 pt-8 pb-14">
				<Outlet />
			</main>
			{/* Map attribution lives on the maps themselves (MapLibre's control),
			    where the data is — a footer credit would read as authorship. */}
			<footer className="border-hairline text-ink-soft border-t px-6 pt-9 pb-10 text-center text-[0.85rem]">
				<p>{m.footerTagline}</p>
				<p className="mt-3 flex flex-wrap justify-center gap-4 [&_a]:text-inherit">
					<Link to={`/${locale}/terms`}>{m.termsTitle}</Link>
					<Link to={`/${locale}/privacy`}>{m.privacyTitle}</Link>
					<Link to={`/${locale}/contact`}>{m.navContact}</Link>
				</p>
				<p className="mt-3">{copyright}</p>
			</footer>
		</>
	);
}
