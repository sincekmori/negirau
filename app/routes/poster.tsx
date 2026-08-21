// QR poster print page. Pure print CSS — the browser's print/save-as-PDF
// is the whole pipeline; there is no server-side PDF generation. Size and
// reaction type live in the URL, so a chosen combination survives reload
// and can be handed to whoever does the printing.
import { Printer } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";

import { ActionButton } from "~/lib/components/ActionButton";
import { BrandIcon } from "~/lib/components/BrandIcon";
import { pillClass } from "~/lib/components/pill";
import { ReactionEmoji } from "~/lib/components/ReactionEmoji";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "~/lib/components/ui/breadcrumb";
import { appContext } from "~/lib/context";
import { messages } from "~/lib/i18n";
import { isPosterSize, POSTER_PAGE_MM, POSTER_PAGE_SIZE, POSTER_SIZES } from "~/lib/poster";
import type { PosterSize } from "~/lib/poster";
import { DEFAULT_REACTION, REACTION_TYPES, isReactionType } from "~/lib/reactions";
import { sendQrSvg } from "~/lib/send-qr";
import { loadActiveSubject } from "~/lib/server/route-helpers";

import type { Route } from "./+types/poster";

import "./poster.css";

export async function loader({ params, request, context }: Route.LoaderArgs) {
	const { env, locale } = context.get(appContext);
	const subject = await loadActiveSubject(env.DB, params.id);
	const url = new URL(request.url);
	const requestedSize = url.searchParams.get("size") ?? "a4";
	const requestedType = url.searchParams.get("type") ?? DEFAULT_REACTION;
	return {
		locale,
		// The printed QR rides the request origin: posters printed from any host
		// (production, dev, a fork) encode that host and stay scannable there.
		origin: url.origin,
		subject: { id: subject.id, name: subject.name },
		size: isPosterSize(requestedSize) ? requestedSize : "a4",
		type: isReactionType(requestedType) ? requestedType : DEFAULT_REACTION,
	};
}

export { pageHeaders as headers } from "~/lib/server/route-helpers";

function PosterBody({
	compact,
	name,
	qrSvg,
	lead,
	hint,
	siteHost,
}: {
	compact: boolean;
	name: string;
	qrSvg: string;
	lead: string;
	hint: string;
	siteHost: string;
}) {
	return (
		<div className={`poster-body${compact ? " compact" : ""}`}>
			<p className="lead">{lead}</p>
			<h2>{name}</h2>
			<div className="qr" dangerouslySetInnerHTML={{ __html: qrSvg }} />
			<p className="hint phrase-wrap">{hint}</p>
			<p className="brand-line">
				<BrandIcon size={compact ? 10 : 16} /> {siteHost}
			</p>
		</div>
	);
}

/** Pill-shaped option links: the app's one segmented-control idiom. */
function OptionPill({
	href,
	selected,
	title,
	children,
}: {
	href: string;
	selected: boolean;
	title?: string;
	children: React.ReactNode;
}) {
	return (
		<a
			href={href}
			aria-current={selected}
			title={title}
			className={`no-underline ${pillClass(selected)}`}
		>
			{children}
		</a>
	);
}

function sheetContents(size: PosterSize, body: (compact: boolean) => React.ReactNode) {
	if (size === "card") {
		return Array.from({ length: 10 }, (_, i) => (
			<div key={i} className="card-cell">
				{body(true)}
			</div>
		));
	}
	if (size === "pop") {
		return (
			<>
				<div className="pop-panel flip">{body(false)}</div>
				<div className="pop-panel">{body(false)}</div>
				<div className="pop-panel base" />
			</>
		);
	}
	return body(false);
}

export default function Poster({ loaderData }: Route.ComponentProps) {
	const { locale, origin, subject, size, type } = loaderData;
	const m = messages(locale);
	// On screen the sheet shrinks to the column: zoom scales the whole layout
	// (mm units and fonts alike), so the preview stays proportional on a phone.
	// Print resets to 1 in poster.css — paper is always true size.
	const host = useRef<HTMLDivElement>(null);
	const [zoom, setZoom] = useState(1);
	useEffect(() => {
		const element = host.current;
		if (!element) {
			return;
		}
		const [widthMm, heightMm] = POSTER_PAGE_MM[size];
		const sheetWidth = (widthMm * 96) / 25.4;
		const sheetHeight = (heightMm * 96) / 25.4;
		// Fit both axes: the preview never exceeds the column or the viewport
		// height (a constant on-screen size; print stays true size).
		const fit = () =>
			setZoom(
				Math.min(1, element.clientWidth / sheetWidth, (window.innerHeight * 0.8) / sheetHeight),
			);
		fit();
		const observer = new ResizeObserver(fit);
		observer.observe(element);
		window.addEventListener("resize", fit);
		return () => {
			observer.disconnect();
			window.removeEventListener("resize", fit);
		};
	}, [size]);
	// Recomputed only when the QR target changes, not on every resize-driven zoom step.
	const qrSvg = useMemo(() => sendQrSvg(origin, subject.id, type), [origin, subject.id, type]);
	const siteHost = new URL(origin).host;
	const body = (compact: boolean) => (
		<PosterBody
			compact={compact}
			name={subject.name}
			qrSvg={qrSvg}
			lead={m.posterLead}
			hint={m.posterHint}
			siteHost={siteHost}
		/>
	);
	return (
		<>
			<title>{`${m.posterPageTitle(subject.name)} | Negirau`}</title>
			<meta name="robots" content="noindex" />
			{/* The printed page must be the sheet, not the browser's default paper. */}
			<style>{`@page { size: ${POSTER_PAGE_SIZE[size]}; margin: 0; }`}</style>

			<div className="poster-controls my-4 mb-8 flex flex-col gap-4">
				{/* Where am I: the poster page belongs to its subject. */}
				<Breadcrumb>
					<BreadcrumbList>
						<BreadcrumbItem>
							<BreadcrumbLink asChild>
								<Link to={`/${locale}/subjects/${subject.id}`}>{subject.name}</Link>
							</BreadcrumbLink>
						</BreadcrumbItem>
						<BreadcrumbSeparator />
						<BreadcrumbItem>
							<BreadcrumbPage>{m.posterCrumb}</BreadcrumbPage>
						</BreadcrumbItem>
					</BreadcrumbList>
				</Breadcrumb>
				<p>{m.posterInstruction}</p>
				<nav aria-label={m.posterSizePickerLabel} className="flex flex-wrap gap-1.5">
					{POSTER_SIZES.map((candidate) => (
						<OptionPill
							key={candidate}
							href={`?size=${candidate}&type=${type}`}
							selected={candidate === size}
						>
							{m.posterSizeLabels[candidate]}
						</OptionPill>
					))}
				</nav>
				{/* Which emoji the printed QR sends: the choice is frozen in ink,
				    so it rides the URL and the preview re-encodes immediately. */}
				<nav aria-label={m.qrTypePickerLabel} className="flex flex-wrap gap-1.5">
					{REACTION_TYPES.map((candidate) => (
						<OptionPill
							key={candidate}
							href={`?size=${size}&type=${candidate}`}
							selected={candidate === type}
							title={m.reactionLabels[candidate]}
						>
							<ReactionEmoji type={candidate} label={m.reactionLabels[candidate]} />
						</OptionPill>
					))}
				</nav>
				{/* A command, not another option: squared, iconed, right-aligned —
				    nothing like the pill rows above. */}
				<div className="flex justify-end">
					<ActionButton
						icon={Printer}
						variant="outline"
						className="border-brand text-brand-deep hover:bg-brand-wash border-2 px-5"
						onClick={() => window.print()}
					>
						{m.posterPrintButton}
					</ActionButton>
				</div>
			</div>

			<div ref={host}>
				<div className={`poster-sheet size-${size}`} style={{ zoom }}>
					{sheetContents(size, body)}
				</div>
			</div>
		</>
	);
}
