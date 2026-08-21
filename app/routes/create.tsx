// The creation form: one datum — the name — entered directly or by picking a
// place from the map. Everything else waits for its moment: the confirmation
// dialog carries the visibility choice, the publication notice, and the final
// register action. No pre-screening — Turnstile and rate limits gate the
// write, and the operator reviews new subjects daily.
import { CirclePlus, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";

import { SUBJECT_NAME_MAX } from "~/lib/api/constants";
import { useWriteAction } from "~/lib/client/use-write-action";
import { ActionButton } from "~/lib/components/ActionButton";
import { LocationPicker } from "~/lib/components/LocationPicker";
import { OverlayDialog } from "~/lib/components/OverlayDialog";
import { pillClass } from "~/lib/components/pill";
import { Input } from "~/lib/components/ui/input";
import { VisibilityPills } from "~/lib/components/VisibilityPills";
import { appContext } from "~/lib/context";
import { formatLatLng } from "~/lib/geo";
import { messages } from "~/lib/i18n";

import type { Route } from "./+types/create";

const MODES = ["name", "map"] as const;
type Mode = (typeof MODES)[number];

interface Draft {
	name: string;
	lat: number | null;
	lng: number | null;
}

function locationText(draft: Draft, none: string): string {
	return draft.lat !== null && draft.lng !== null ? formatLatLng(draft.lat, draft.lng) : none;
}

function draftFromForm(form: FormData, mode: Mode): Draft {
	const coordinate = (field: string) => {
		const value = String(form.get(field) ?? "").trim();
		return value === "" ? null : Number(value);
	};
	return {
		name: String(form.get("name") ?? "").trim(),
		// The location rides only the map mode; a typed name attaches none.
		lat: mode === "map" ? coordinate("lat") : null,
		lng: mode === "map" ? coordinate("lng") : null,
	};
}

export function loader({ context }: Route.LoaderArgs) {
	const { env, locale } = context.get(appContext);
	return { locale, turnstileSiteKey: env.TURNSTILE_SITE_KEY };
}

export function shouldRevalidate() {
	// The action mutates nothing this page renders; skip the post-submit
	// loader round trip (success navigates to the fresh subject anyway).
	return false;
}

export default function Create({ loaderData }: Route.ComponentProps) {
	const { locale, turnstileSiteKey } = loaderData;
	const m = messages(locale);
	const navigate = useNavigate();

	const nameField = useRef<HTMLInputElement>(null);
	// How the name arrives: typed directly, or picked from the map (which
	// also attaches the location).
	const [mode, setMode] = useState<Mode>("name");
	const [listed, setListed] = useState(true);
	// The reviewed input, frozen when the confirmation dialog opens.
	const [draft, setDraft] = useState<Draft | undefined>(undefined);
	const { hostRef, submitting, notice, data, submit, clearNotice } = useWriteAction({
		siteKey: turnstileSiteKey,
		m,
		failed: m.createFailed,
	});

	// Step 1 — review: freeze the form into a draft and open the confirmation.
	function review(event: React.FormEvent<HTMLFormElement>): void {
		event.preventDefault();
		clearNotice();
		setDraft(draftFromForm(new FormData(event.currentTarget), mode));
	}

	// Step 2 — register: the confirmed draft becomes the subject.
	function register(): void {
		if (draft) {
			void submit(
				{ name: draft.name, lat: draft.lat, lng: draft.lng, listed },
				{ method: "POST", action: "/subjects" },
			);
		}
	}

	// Success is a navigation, so it lives in an effect; refusals render
	// directly from the write hook's notice.
	const createdId = data?.id;
	useEffect(() => {
		if (createdId !== undefined) {
			void navigate(`/${locale}/subjects/${createdId}`);
		}
	}, [createdId, locale, navigate]);

	return (
		<>
			<title>{`${m.createTitle} | Negirau`}</title>
			<meta name="robots" content="noindex" />
			<h1 className="text-2xl font-semibold">{m.createTitle}</h1>
			<p className="mt-4">{m.createIntro}</p>

			<form className="mt-8 flex flex-col gap-6" onSubmit={review}>
				{/* The one real choice up front: how the name arrives. */}
				<fieldset aria-label={m.createModeLegend} className="flex flex-wrap gap-1">
					{MODES.map((candidate) => (
						<label key={candidate} className={`cursor-pointer ${pillClass(mode === candidate)}`}>
							<input
								type="radio"
								name="mode"
								checked={mode === candidate}
								onChange={() => setMode(candidate)}
								className="sr-only"
							/>
							{candidate === "name" ? m.createModeName : m.createModeMap}
						</label>
					))}
				</fieldset>

				{mode === "map" && (
					<LocationPicker
						locale={locale}
						// A found place names the subject: picking from the map IS naming.
						onPlacePicked={(placeName) => {
							if (nameField.current) {
								nameField.current.value = placeName;
							}
						}}
					/>
				)}

				<label className="flex flex-col gap-1.5">
					{m.createNameLabel}
					<Input
						name="name"
						required
						maxLength={SUBJECT_NAME_MAX}
						placeholder={m.createNamePlaceholder}
						ref={nameField}
					/>
				</label>

				{/* Everything else — visibility, the publication notice, the real
				    register action — waits inside the confirmation dialog. */}
				<div className="flex justify-end">
					<ActionButton type="submit" size="lg" icon={Search}>
						{m.createConfirm}
					</ActionButton>
				</div>
			</form>

			<OverlayDialog
				open={draft !== undefined}
				onOpenChange={(open) => !open && setDraft(undefined)}
				title={m.createConfirmTitle}
			>
				{draft && (
					<dl className="flex flex-col gap-1 text-[0.95rem]">
						<div className="flex gap-3">
							<dt className="text-ink-soft shrink-0">{m.createNameLabel}</dt>
							<dd className="font-medium">{draft.name}</dd>
						</div>
						<div className="flex gap-3">
							<dt className="text-ink-soft shrink-0">{m.createLocationLabel}</dt>
							<dd>{locationText(draft, m.locationNone)}</dd>
						</div>
					</dl>
				)}
				<VisibilityPills listed={listed} onChange={setListed} m={m} />
				<p className="text-ink-soft text-[0.85rem]">{m.visibilityUnlistedHint}</p>
				<p className="text-ink-soft text-[0.85rem]">
					{m.createPublicNotice} (
					{/* A new tab: navigating this tab would discard the reviewed draft. */}
					<Link to={`/${locale}/privacy`} target="_blank" rel="noreferrer noopener">
						{m.privacyTitle}
					</Link>
					)
				</p>
				<div className="flex justify-end">
					<ActionButton icon={CirclePlus} disabled={submitting} onClick={register}>
						{m.createSubmit}
					</ActionButton>
				</div>
				{notice !== undefined && (
					<p aria-live="polite" className="text-ink-soft text-[0.85rem]">
						{notice}
					</p>
				)}
			</OverlayDialog>

			<div ref={hostRef} className="fixed inset-e-2 bottom-2" />
		</>
	);
}
