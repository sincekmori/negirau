// The edit page: update and delete REQUESTS, not edits. With no accounts
// there is no one to authorize a change, so both flows queue a request for
// the operator's review — the page mirrors the create form's two steps
// (review → confirm dialog → send) and never mutates the subject itself.
import { ArrowLeft, Send, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";

import { SUBJECT_NAME_MAX } from "~/lib/api/constants";
import { useWriteAction } from "~/lib/client/use-write-action";
import { ActionButton } from "~/lib/components/ActionButton";
import { OverlayDialog } from "~/lib/components/OverlayDialog";
import { Input } from "~/lib/components/ui/input";
import { VisibilityPills } from "~/lib/components/VisibilityPills";
import { appContext } from "~/lib/context";
import { messages } from "~/lib/i18n";
import type { Messages } from "~/lib/i18n";
import { loadActiveSubject } from "~/lib/server/route-helpers";

import type { Route } from "./+types/edit";

type Draft = { kind: "update"; name: string; listed: boolean } | { kind: "delete" };

export async function loader({ params, context }: Route.LoaderArgs) {
	const { env, locale } = context.get(appContext);
	const subject = await loadActiveSubject(env.DB, params.id);
	return {
		locale,
		subject: { id: subject.id, name: subject.name, listed: subject.listed === 1 },
		turnstileSiteKey: env.TURNSTILE_SITE_KEY,
	};
}

export function shouldRevalidate() {
	// The action queues a request without mutating the subject this page
	// renders; skip the post-submit loader round trip (and its D1 read).
	return false;
}

function DraftSummary({ draft, m }: { draft: Draft; m: Messages }) {
	if (draft.kind === "delete") {
		return <p className="text-[0.95rem]">{m.deleteBody}</p>;
	}
	return (
		<dl className="flex flex-col gap-1 text-[0.95rem]">
			<div className="flex gap-3">
				<dt className="text-ink-soft shrink-0">{m.createNameLabel}</dt>
				<dd className="font-medium">{draft.name}</dd>
			</div>
			<div className="flex gap-3">
				<dt className="text-ink-soft shrink-0">{m.createVisibilityLegend}</dt>
				<dd>{draft.listed ? m.visibilityListed : m.visibilityUnlisted}</dd>
			</div>
		</dl>
	);
}

export default function Edit({ loaderData }: Route.ComponentProps) {
	const { locale, subject, turnstileSiteKey } = loaderData;
	const m = messages(locale);
	const navigate = useNavigate();

	const [listed, setListed] = useState(subject.listed);
	// The reviewed input, frozen when a confirmation dialog opens.
	const [draft, setDraft] = useState<Draft | undefined>(undefined);
	const { hostRef, submitting, notice, data, submit, clearNotice } = useWriteAction({
		siteKey: turnstileSiteKey,
		m,
		failed: m.requestFailed,
	});
	const requested = data?.ok === true;

	// Step 1 — review: freeze the form into a draft and open the confirmation.
	function review(event: React.FormEvent<HTMLFormElement>): void {
		event.preventDefault();
		clearNotice();
		const form = new FormData(event.currentTarget);
		setDraft({ kind: "update", name: String(form.get("name") ?? "").trim(), listed });
	}

	// Step 2 — send: the confirmed draft becomes a queued request.
	function send(): void {
		if (!draft) {
			return;
		}
		void submit(draft.kind === "update" ? { name: draft.name, listed: draft.listed } : {}, {
			method: draft.kind === "update" ? "PATCH" : "DELETE",
			action: `/subjects/${subject.id}`,
		});
	}

	function close(open: boolean): void {
		if (!open) {
			if (requested) {
				// The request went through; dismissing the dialog means leaving.
				void navigate(`/${locale}/subjects/${subject.id}`);
				return;
			}
			setDraft(undefined);
		}
	}

	return (
		<>
			<title>{`${m.editTitle} | Negirau`}</title>
			<meta name="robots" content="noindex" />
			<h1 className="text-2xl font-semibold">{m.editTitle}</h1>
			<p className="mt-4">
				<Link to={`/${locale}/subjects/${subject.id}`}>{subject.name}</Link>
			</p>
			<p className="text-ink-soft mt-2 text-[0.85rem]">{m.editIntro}</p>

			<form className="mt-8 flex flex-col gap-6" onSubmit={review}>
				<label className="flex flex-col gap-1.5">
					{m.createNameLabel}
					<Input name="name" required maxLength={SUBJECT_NAME_MAX} defaultValue={subject.name} />
				</label>
				<VisibilityPills listed={listed} onChange={setListed} m={m} />
				<p className="text-ink-soft text-[0.85rem]">{m.visibilityUnlistedHint}</p>
				<div className="flex justify-end">
					<ActionButton type="submit" size="lg" icon={Send}>
						{m.createConfirm}
					</ActionButton>
				</div>
			</form>

			<section className="border-hairline mt-12 border-t pt-8">
				<h2 className="text-lg font-semibold">{m.deleteHeading}</h2>
				<p className="text-ink-soft mt-2 text-[0.85rem]">{m.deleteBody}</p>
				<div className="mt-4 flex justify-end">
					<ActionButton
						icon={Trash2}
						variant="outline"
						className="border-brand text-brand-deep hover:bg-brand-wash"
						onClick={() => {
							clearNotice();
							setDraft({ kind: "delete" });
						}}
					>
						{m.deleteButton}
					</ActionButton>
				</div>
			</section>

			<OverlayDialog
				open={draft !== undefined}
				onOpenChange={close}
				title={draft?.kind === "delete" ? m.deleteConfirmTitle : m.editConfirmTitle}
			>
				{requested ? (
					<>
						<p className="text-[0.95rem]">{m.editRequested}</p>
						<div className="flex justify-end">
							<ActionButton
								icon={ArrowLeft}
								onClick={() => void navigate(`/${locale}/subjects/${subject.id}`)}
							>
								{m.editBackToPage}
							</ActionButton>
						</div>
					</>
				) : (
					<>
						{draft && <DraftSummary draft={draft} m={m} />}
						<div className="flex justify-end">
							<ActionButton icon={Send} disabled={submitting} onClick={send}>
								{m.editSubmit}
							</ActionButton>
						</div>
						{notice !== undefined && (
							<p aria-live="polite" className="text-ink-soft text-[0.85rem]">
								{notice}
							</p>
						)}
					</>
				)}
			</OverlayDialog>

			<div ref={hostRef} className="fixed inset-e-2 bottom-2" />
		</>
	);
}
