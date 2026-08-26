// The subject page: one-tap reactions behind Turnstile, QR direct send, share.
import { SmilePlus } from "lucide-react";
import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { Link } from "react-router";

import { OG_TEMPLATE_VERSION } from "~/lib/brand";
import { alreadySentToday, markSentToday, unmarkSentToday } from "~/lib/client/sent-log";
import { mountTurnstile } from "~/lib/client/turnstile";
import type { TokenProvider } from "~/lib/client/turnstile";
import { EmbedDialog } from "~/lib/components/EmbedDialog";
import { ReactionEmoji } from "~/lib/components/ReactionEmoji";
import { ShareMenu } from "~/lib/components/ShareMenu";
import { SubjectMap } from "~/lib/components/SubjectMap";
import { Button } from "~/lib/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "~/lib/components/ui/dropdown-menu";
import { appContext } from "~/lib/context";
import { clampForDisplay, displayValue } from "~/lib/display-value";
import { messages, totalHeadline } from "~/lib/i18n";
import {
	DEFAULT_REACTION,
	REACTION_EMOJI,
	REACTION_TYPES,
	UNDO_WINDOW_MS,
	isReactionType,
} from "~/lib/reactions";
import type { ReactionType } from "~/lib/reactions";
import { sendQrSvg } from "~/lib/send-qr";
import { countsSummary } from "~/lib/server/db";
import {
	actionJson,
	clientIp,
	jsonBody,
	loadActiveSubject,
	refusalResponse,
} from "~/lib/server/route-helpers";
import { handleSubjectRequest } from "~/lib/server/subject-request";

import type { Route } from "./+types/subject";

// PATCH/DELETE /subjects/:id queue update/delete REQUESTS — with no auth
// there is nothing to apply them against automatically, so the operator
// reviews the queue daily (see subject_requests in the schema).
export async function action({ request, params, context }: Route.ActionArgs) {
	const { env } = context.get(appContext);
	const result = await handleSubjectRequest(
		env,
		clientIp(request),
		params.id,
		request.method,
		await jsonBody(request),
	);
	if (!result.ok) {
		return refusalResponse(result);
	}
	return actionJson({ ok: true });
}

export async function loader({ params, request, context }: Route.LoaderArgs) {
	const { env, locale } = context.get(appContext);
	const subject = await loadActiveSubject(env.DB, params.id);
	const summary = await countsSummary(env.DB, subject.rowid);
	// Clamped before it leaves the worker: loader data is serialised into the
	// page HTML, so a raw sum here would publish the exact count.
	const byType = Object.fromEntries(
		Object.entries(summary.byType).map(([type, count]) => [type, clampForDisplay(count)]),
	);
	return {
		locale,
		// User-facing absolute URLs (OG, share, badges) ride the request origin
		// so previews resolve on every host; SEO signals stay canonical.
		origin: new URL(request.url).origin,
		subject: {
			id: subject.id,
			name: subject.name,
			lat: subject.lat,
			lng: subject.lng,
			listed: subject.listed === 1,
		},
		countsByType: byType,
		turnstileSiteKey: env.TURNSTILE_SITE_KEY,
	};
}

export { pageHeaders as headers } from "~/lib/server/route-helpers";

function chipTitle(
	sent: boolean,
	undoable: boolean,
	m: ReturnType<typeof messages>,
	type: ReactionType,
): string {
	if (undoable) {
		return m.undoHint;
	}
	return sent ? m.sentAlreadyToday : m.reactionLabels[type];
}

function chipClass(sent: boolean, popping: boolean): string {
	const tone = sent
		? "border-brand bg-brand-wash text-brand-deep"
		: "border-hairline hover:bg-brand-wash";
	return `h-auto rounded-full px-3 py-1.5 text-[1rem] disabled:opacity-100 ${tone} ${popping ? "pop-in" : ""}`;
}

function SubjectLocation({
	subject,
	label,
}: {
	subject: { lat: number | null; lng: number | null };
	label: string;
}) {
	if (subject.lat === null || subject.lng === null) {
		return null;
	}
	return <SubjectMap lat={subject.lat} lng={subject.lng} label={label} />;
}

export default function Subject({ loaderData }: Route.ComponentProps) {
	const { locale, origin, subject, countsByType, turnstileSiteKey } = loaderData;
	const m = messages(locale);

	const turnstileHost = useRef<HTMLDivElement>(null);
	const tokens = useRef<TokenProvider | undefined>(undefined);
	const undoTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
	// Server-rendered controls look live before hydration; gate them so a tap
	// is never silently swallowed on a slow connection.
	const [ready, setReady] = useState(false);
	const [sentTypes, setSentTypes] = useState<ReactionType[]>([]);
	// Optimistic count deltas: +1 on a send, -1 on its undo, on top of the
	// server-rendered all-time counts.
	const [delta, setDelta] = useState<Partial<Record<ReactionType, number>>>({});
	const [sending, setSending] = useState(false);
	// One state, because it is one thing: the live undo affordance. Split
	// across a type and a token they drift — the expiry timer would clear the
	// token and leave a chip that still looks undoable.
	const [pendingUndo, setPendingUndo] = useState<{ type: ReactionType; token: string } | undefined>(
		undefined,
	);
	const [notice, setNotice] = useState<string | undefined>(undefined);
	const [embedOpen, setEmbedOpen] = useState(false);
	// The QR arrival feedback: the sent emoji blooms over the page for a
	// moment (cleared when its animation ends), then the pressed chip carries
	// the state. Scanners did nothing on the page, so it must visibly answer.
	const [celebrated, setCelebrated] = useState<ReactionType | undefined>(undefined);
	// Which reaction the on-screen QR sends; the emoji pills switch it live.
	const [qrType, setQrType] = useState<ReactionType>(DEFAULT_REACTION);

	const pageUrl = `${origin}/subjects/${subject.id}`;

	// The undo window outlives fast navigation; never let it outlive the page.
	useEffect(() => () => clearTimeout(undoTimer.current), []);

	function refreshSentTypes(): void {
		setSentTypes(REACTION_TYPES.filter((type) => alreadySentToday(subject.id, type)));
	}

	async function send(type: ReactionType, celebrate = false): Promise<void> {
		if (sending || alreadySentToday(subject.id, type) || !tokens.current) {
			return;
		}
		setSending(true);
		setNotice(undefined);
		try {
			const token = await tokens.current.take();
			const response = await fetch(`/subjects/${subject.id}/reactions`, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ type, token }),
			});
			if (response.status === 429) {
				setNotice(m.noticeRateLimited);
				return;
			}
			if (response.status === 409) {
				// The server-side dedupe cookie already saw today's send of this type.
				markSentToday(subject.id, type);
				refreshSentTypes();
				setNotice(m.sentAlreadyToday);
				return;
			}
			if (!response.ok) {
				setNotice(m.noticeSendFailed);
				return;
			}
			const body = (await response.json()) as { undo_token: string };
			markSentToday(subject.id, type);
			refreshSentTypes();
			setDelta((current) => ({ ...current, [type]: (current[type] ?? 0) + 1 }));
			setPendingUndo({ type, token: body.undo_token });
			clearTimeout(undoTimer.current);
			undoTimer.current = setTimeout(() => setPendingUndo(undefined), UNDO_WINDOW_MS);
			if (celebrate) {
				setCelebrated(type);
			}
		} catch {
			setNotice(m.noticeNetworkFailed);
		} finally {
			setSending(false);
		}
	}

	// An effect event, so the one-shot boot reads the latest handlers and site
	// key without depending on their per-render identities: Turnstile mounts
	// once, and the QR auto-send must not repeat on re-renders.
	const bootPage = useEffectEvent(() => {
		const host = turnstileHost.current;
		if (!host) {
			return;
		}
		tokens.current = mountTurnstile(host, turnstileSiteKey);
		setReady(true);
		void (async () => {
			// Read the device-local sent log once the client owns the page.
			refreshSentTypes();
			// QR direct send: ?send=<type> names the reaction. The
			// GET has no side effect; the reaction is an explicit client POST
			// behind Turnstile, so preview bots never count.
			const requested = new URLSearchParams(window.location.search).get("send");
			if (requested !== null && isReactionType(requested)) {
				// The scanner tapped nothing here, so the page answers visibly.
				await send(requested, true);
			}
		})();
	});
	useEffect(() => {
		bootPage();
	}, []);

	async function undo(): Promise<void> {
		if (pendingUndo === undefined) {
			return;
		}
		const { type, token } = pendingUndo;
		const response = await fetch(`/subjects/${subject.id}/reactions`, {
			method: "DELETE",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ type, undo_token: token }),
		});
		if (response.ok) {
			unmarkSentToday(subject.id, type);
			refreshSentTypes();
			setDelta((current) => ({ ...current, [type]: (current[type] ?? 0) - 1 }));
		}
		setPendingUndo(undefined);
	}

	function countOf(type: ReactionType): number {
		return (countsByType[type] ?? 0) + (delta[type] ?? 0);
	}
	// A chip exists once the subject holds that reaction (or I sent it just now);
	// everything else waits inside the picker.
	const chipTypes = REACTION_TYPES.filter((type) => countOf(type) > 0 || sentTypes.includes(type));
	const pickerTypes = REACTION_TYPES.filter((type) => !chipTypes.includes(type));
	const total = REACTION_TYPES.reduce((sum, type) => sum + countOf(type), 0);
	// One flag for "controls may act": hydrated and not mid-request.
	const busy = !ready || sending;

	const description = totalHeadline(m, total);
	// QR encoding is the priciest pure computation in this component; only the
	// picked type changes it, not every reaction-count rerender.
	const qrSvg = useMemo(() => sendQrSvg(origin, subject.id, qrType), [origin, subject.id, qrType]);

	return (
		<>
			<title>{`${subject.name} | Negirau`}</title>
			<meta name="description" content={description} />
			{/* Link-only pages must not surface through search engines either. */}
			{!subject.listed && <meta name="robots" content="noindex" />}
			<meta property="og:title" content={m.ogTitle(subject.name)} />
			<meta property="og:description" content={description} />
			<meta
				property="og:image"
				content={`${origin}/subjects/${subject.id}/og?v=${OG_TEMPLATE_VERSION}`}
			/>
			<meta property="og:image:width" content="1200" />
			<meta property="og:image:height" content="630" />
			<meta property="og:image:alt" content={subject.name} />
			<meta property="og:url" content={`${origin}/${locale}/subjects/${subject.id}`} />
			<meta name="twitter:card" content="summary_large_image" />
			<link
				rel="alternate"
				type="application/atom+xml"
				href={`/subjects/${subject.id}/feed`}
				title={subject.name}
			/>

			<article>
				<h1 className="text-2xl font-semibold">{subject.name}</h1>
				<SubjectLocation subject={subject} label={m.subjectMapLabel} />

				{/* Chat-style reactions, right under the name like reactions under a
				    message: chips for what the subject already holds, a picker for the
				    rest. A pressed chip taps back off while its undo voucher lives —
				    no text, the chip itself is the feedback. */}
				<section className="mt-6 flex flex-wrap items-center gap-2">
					{chipTypes.map((type) => {
						const sent = sentTypes.includes(type);
						const undoable = sent && pendingUndo?.type === type;
						return (
							<Button
								key={type}
								variant="outline"
								data-reaction={type}
								aria-pressed={sent}
								disabled={busy || (sent && !undoable)}
								title={chipTitle(sent, undoable, m, type)}
								className={chipClass(sent, pendingUndo?.type === type)}
								onClick={() => void (sent ? undo() : send(type))}
							>
								<ReactionEmoji type={type} label={m.reactionLabels[type]} />
								<span className="ms-1 text-[0.85rem]">{displayValue(countOf(type))}</span>
							</Button>
						);
					})}
					{pickerTypes.length > 0 && (
						<DropdownMenu modal={false}>
							<DropdownMenuTrigger asChild>
								<Button
									variant="outline"
									aria-label={m.addReaction}
									title={m.addReaction}
									disabled={busy}
									className="border-brand text-brand-deep hover:bg-brand-wash h-auto rounded-full border-2 px-3 py-1.5"
								>
									<SmilePlus aria-hidden="true" className="size-5" />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent className="flex flex-row gap-1 rounded-full px-2 py-1">
								{pickerTypes.map((type) => (
									<DropdownMenuItem
										key={type}
										data-reaction={type}
										className="rounded-full px-2 py-1.5 text-[1.2rem]"
										onSelect={() => void send(type)}
									>
										<ReactionEmoji type={type} label={m.reactionLabels[type]} />
									</DropdownMenuItem>
								))}
							</DropdownMenuContent>
						</DropdownMenu>
					)}
					{/* Nothing yet: a static invitation beside the picker, so a first
					    visitor knows what the button is for. It leaves once anything
					    is sent — a state change, not ephemeral feedback. */}
					{chipTypes.length === 0 && (
						<span className="text-ink-soft text-[0.9rem]">{m.reactionInvite}</span>
					)}
					{notice !== undefined && <p className="text-ink-soft w-full text-[0.85rem]">{notice}</p>}
				</section>

				{/* One sharing hub plus the always-there QR: share a screen in a
				    meeting and the room can scan and send on the spot. */}
				{/* The sharing zone, visually its own thing: a hairline above, then
				    one centered column — QR card, emoji dial, hint, share hub. */}
				<section className="border-hairline mt-12 flex flex-col items-center gap-3 border-t pt-8 text-center">
					<div className="bg-paper-fixed text-ink-fixed w-fit rounded-lg px-3 py-2 shadow-sm">
						{/* One width knob: the QR fills this column and the caption
						    truncates to it, so neither can drift from the other. */}
						<div className="w-36">
							{/* Name only: the pin lives inside the QR itself. */}
							<p className="mb-1 truncate text-[0.8rem] font-medium">{subject.name}</p>
							{/* Decorative for readers: the caption and hint already say it. */}
							<div
								aria-hidden="true"
								data-qr-type={qrType}
								className="aspect-square w-full [&_svg]:size-full"
								dangerouslySetInnerHTML={{ __html: qrSvg }}
							/>
							<p className="mt-1 text-[0.8rem] font-medium">{m.sendVerb(REACTION_EMOJI[qrType])}</p>
						</div>
					</div>
					<fieldset aria-label={m.qrTypePickerLabel} className="flex gap-1">
						{REACTION_TYPES.map((type) => (
							<Button
								key={type}
								variant="outline"
								aria-pressed={qrType === type}
								title={m.reactionLabels[type]}
								className={`h-auto rounded-full p-1.5 text-[0.85rem] leading-none ${
									qrType === type
										? "border-brand bg-brand-wash"
										: "border-hairline opacity-60 hover:opacity-100"
								}`}
								onClick={() => setQrType(type)}
							>
								<ReactionEmoji type={type} label={m.reactionLabels[type]} />
							</Button>
						))}
					</fieldset>
					<p className="text-ink-soft phrase-wrap text-[0.9rem]">{m.posterHint}</p>
					<ShareMenu
						name={subject.name}
						pageUrl={pageUrl}
						posterHref={`/${locale}/subjects/${subject.id}/poster`}
						onOpenEmbed={() => setEmbedOpen(true)}
						m={m}
					/>
				</section>

				<EmbedDialog
					origin={origin}
					subjectId={subject.id}
					locale={locale}
					open={embedOpen}
					onOpenChange={setEmbedOpen}
				/>

				{/* QR arrival feedback: a fixed overlay, so nothing reflows and
				    nothing needs dismissing — it blooms and hands off to the chip. */}
				{celebrated !== undefined && (
					<div
						aria-hidden="true"
						className="pointer-events-none fixed inset-0 z-50 grid place-items-center"
					>
						<span className="send-burst text-7xl" onAnimationEnd={() => setCelebrated(undefined)}>
							{REACTION_EMOJI[celebrated]}
						</span>
					</div>
				)}
				<span aria-live="polite" className="sr-only">
					{celebrated === undefined ? "" : m.sentAnnounce}
				</span>

				<p className="text-ink-soft mt-10 text-[0.8rem]">
					{/* Wrong name, unwanted subject: the edit page queues the request. */}
					<Link className="text-inherit" to={`/${locale}/subjects/${subject.id}/edit`}>
						{m.subjectReportLink}
					</Link>
				</p>
			</article>

			<div ref={turnstileHost} className="fixed inset-e-2 bottom-2" />
		</>
	);
}
