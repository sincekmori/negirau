// The landing page: ink on paper, one motif, room to breathe.
import { CirclePlus } from "lucide-react";
import { Link } from "react-router";

import { HEART_PIN_DOT, HEART_PIN_OUTLINE_PATH, OG_TEMPLATE_VERSION } from "~/lib/brand";
import { ActionButton } from "~/lib/components/ActionButton";
import { NearbyFinder } from "~/lib/components/NearbyFinder";
import { SubjectPills } from "~/lib/components/SubjectPills";
import { SubjectSearch } from "~/lib/components/SubjectSearch";
import { appContext } from "~/lib/context";
import { messages } from "~/lib/i18n";
import { listSubjectsBefore } from "~/lib/server/db";

import type { Route } from "./+types/home";

const SHELF_SIZE = 12;

export async function loader({ request, context }: Route.LoaderArgs) {
	const { env, locale, site } = context.get(appContext);
	const recent = await listSubjectsBefore(env.DB, undefined, SHELF_SIZE);
	return {
		locale,
		// User-facing absolute URLs (OG, share) ride the request origin so
		// previews resolve on every host; SEO signals stay on the canonical origin.
		origin: new URL(request.url).origin,
		canonicalOrigin: site.canonical,
		recent: recent.map((s) => ({ id: s.id, name: s.name })),
	};
}

export { pageHeaders as headers } from "~/lib/server/route-helpers";

export default function Home({ loaderData }: Route.ComponentProps) {
	const { locale, origin, canonicalOrigin, recent } = loaderData;
	const m = messages(locale);
	// Minimal structured data: the site and its publisher.
	const jsonLd = JSON.stringify({
		"@context": "https://schema.org",
		"@type": "WebSite",
		name: "Negirau",
		url: canonicalOrigin,
		inLanguage: locale,
		description: m.topDescription,
	});
	return (
		<>
			<title>{m.topTitle}</title>
			<meta name="description" content={m.topDescription} />
			<meta property="og:title" content={m.topTitle} />
			<meta property="og:description" content={m.topDescription} />
			<meta property="og:url" content={`${origin}/${locale}`} />
			<meta property="og:image" content={`${origin}/og/site?v=${OG_TEMPLATE_VERSION}`} />
			<meta property="og:image:width" content="1200" />
			<meta property="og:image:height" content="630" />
			<meta property="og:image:alt" content="Negirau" />
			<meta name="twitter:card" content="summary_large_image" />
			<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />

			{/* Hero breathing room, net of the 2rem the layout's main already adds. */}
			<section className="pt-[clamp(1.5rem,calc(11vh-2rem),4.5rem)] pb-[clamp(3rem,8vh,5rem)] text-center">
				{/* The heart-pin, drawn like a single stroke (outline from BrandIcon). */}
				<svg
					className="pin-draw text-brand mx-auto mb-[clamp(1.4rem,4vh,2.4rem)] w-[clamp(3.5rem,8vw,4.5rem)]"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth={1.2}
					strokeLinecap="round"
					strokeLinejoin="round"
					aria-hidden="true"
				>
					<path d={HEART_PIN_OUTLINE_PATH} pathLength={1} />
					<circle cx={HEART_PIN_DOT.cx} cy={HEART_PIN_DOT.cy} r={HEART_PIN_DOT.r} pathLength={1} />
				</svg>
				<h1 className="text-[clamp(1.9rem,5.4vw,3rem)] leading-[1.3] font-[350] tracking-wide text-balance">
					{m.heroTitle.split("\n").map((line) => (
						<span key={line} className="block">
							{line}
						</span>
					))}
				</h1>
				<p className="text-ink-soft mx-auto mt-6 max-w-xl">{m.heroBody}</p>
				<div className="mt-10 flex flex-wrap items-center justify-center gap-6">
					<ActionButton to={`/${locale}/subjects/new`} size="lg" icon={CirclePlus}>
						{m.heroCtaCreate}
					</ActionButton>
					<a
						href="#nearby"
						className="border-hairline text-ink-soft hover:text-ink border-b text-[0.9rem] no-underline hover:border-current"
					>
						{m.heroCtaNearby}
					</a>
				</div>
			</section>

			<div className="border-hairline border-t pt-10 pb-12">
				<SubjectSearch locale={locale} />
			</div>

			<section className="border-hairline border-t pt-10 pb-12">
				<h2>{m.recentHeading}</h2>
				<SubjectPills locale={locale} subjects={recent} />
				{recent.length > 0 && (
					<p className="mt-6 text-[0.9rem]">
						<Link to={`/${locale}/subjects`}>{m.subjectsAllLink}</Link>
					</p>
				)}
			</section>

			<div className="border-hairline border-t pt-10 pb-12" id="nearby">
				<NearbyFinder locale={locale} />
			</div>

			<section className="border-hairline border-t pt-10 pb-12">
				<h2>{m.howHeading}</h2>
				{/* Mobile-first: one column, three from 40rem up. */}
				<ol className="grid grid-cols-1 gap-6 min-[40rem]:grid-cols-3 min-[40rem]:gap-8">
					{m.howSteps.map((step, index) => (
						<li key={step.title}>
							<span className="text-brand-deep block text-[0.8rem] tracking-widest">
								{index + 1}
							</span>
							<h3 className="mt-1 mb-2 text-base font-semibold">{step.title}</h3>
							<p className="text-ink-soft text-[0.88rem]">{step.body}</p>
						</li>
					))}
				</ol>
			</section>

			<section className="border-hairline border-t pt-10 pb-12">
				<h2>{m.devHeading}</h2>
				<p className="text-ink-soft mb-4">{m.devBody}</p>
				<p className="text-[0.9rem]">
					<Link to={`/${locale}/developers`}>{m.devPageLinkLabel}</Link>
				</p>
			</section>
		</>
	);
}
