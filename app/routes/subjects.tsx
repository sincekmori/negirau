// The /subjects listing: search on top, then every listed subject newest
// first with keyset pagination. Recency is the only order — counts never
// sort anything (anti-ranking), and link-only subjects never appear.
import { Link } from "react-router";

import { SubjectPills } from "~/lib/components/SubjectPills";
import { SubjectSearch } from "~/lib/components/SubjectSearch";
import { appContext } from "~/lib/context";
import { decodeCursor, paginate } from "~/lib/cursor";
import { messages } from "~/lib/i18n";
import { createBodySchema, handleCreate } from "~/lib/server/create-subject";
import { listSubjectsBefore } from "~/lib/server/db";
import { actionJson, clientIp, jsonBody, refusalResponse } from "~/lib/server/route-helpers";

import type { Route } from "./+types/subjects";

const PAGE_SIZE = 50;

// POST /subjects creates (first-party, Turnstile-gated — deliberately not in
// the public v1 spec): the collection page owns the collection's write.
export async function action({ request, context }: Route.ActionArgs) {
	const { env } = context.get(appContext);
	const parsed = createBodySchema.safeParse(await jsonBody(request));
	if (!parsed.success) {
		return refusalResponse({ status: 400, error: "invalid_body" });
	}
	const result = await handleCreate(env, clientIp(request), parsed.data);
	if (!result.ok) {
		return refusalResponse(result);
	}
	return actionJson({ ok: true, id: result.subject.id }, 201);
}

export async function loader({ request, context }: Route.LoaderArgs) {
	const { env, locale } = context.get(appContext);
	const cursor = new URL(request.url).searchParams.get("cursor") ?? undefined;
	const beforeRowid =
		cursor === undefined ? undefined : await decodeCursor(env.TURNSTILE_SECRET_KEY, cursor);
	if (cursor !== undefined && beforeRowid === undefined) {
		throw new Response("not found", { status: 404 });
	}
	// One extra row tells whether a next page exists.
	const rows = await listSubjectsBefore(env.DB, beforeRowid, PAGE_SIZE + 1);
	const { page, nextCursor } = await paginate(env.TURNSTILE_SECRET_KEY, rows, PAGE_SIZE);
	return {
		locale,
		subjects: page.map((row) => ({ id: row.id, name: row.name })),
		nextCursor,
	};
}

export { pageHeaders as headers } from "~/lib/server/route-helpers";

export default function Subjects({ loaderData }: Route.ComponentProps) {
	const { locale, subjects, nextCursor } = loaderData;
	const m = messages(locale);
	return (
		<>
			<title>{`${m.subjectsTitle} | Negirau`}</title>
			<meta name="description" content={m.subjectsIntro} />
			<h1 className="text-2xl font-semibold">{m.subjectsTitle}</h1>
			<p className="text-ink-soft mt-4">{m.subjectsIntro}</p>

			<div className="mt-8">
				<SubjectSearch locale={locale} />
			</div>

			<section className="mt-10">
				<SubjectPills locale={locale} subjects={subjects} />
				{nextCursor !== null && (
					<p className="mt-8">
						<Link to={`/${locale}/subjects?cursor=${nextCursor}`}>{m.subjectsMore}</Link>
					</p>
				)}
			</section>
		</>
	);
}
