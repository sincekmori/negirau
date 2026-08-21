// GET /subjects/:id/feed — the pull-only substitute for email notifications: one
// entry per ISO week with reaction display values, consumable from any feed
// reader or Slack RSS integration. No personal data changes hands.

import { appContext } from "~/lib/context";
import { displayValue } from "~/lib/display-value";
import { DEFAULT_LOCALE, messages, weeklyHeadline } from "~/lib/i18n";
import { isoWeekId, recentWeeks } from "~/lib/period";
import { isReactionType, REACTION_EMOJI } from "~/lib/reactions";
import { countsByDay } from "~/lib/server/db";
import type { SubjectRow } from "~/lib/server/db";
import { edgeCachedByUrl } from "~/lib/server/edge-cache";
import { cachedResponse, escapeXml, loadActiveSubject } from "~/lib/server/route-helpers";

import type { Route } from "./+types/feed";

const FEED_WEEK_COUNT = 8;

// Locale-fixed on purpose: the feed is machine-polled hourly and shares one
// cache entry per URL; per-locale variants would fragment that cache.
const m = messages(DEFAULT_LOCALE);

function weekEntry(
	subject: SubjectRow,
	origin: string,
	weekId: string,
	summary: { total: number; byType: Record<string, number> },
	updated: string,
): string {
	// A text-only surface: feed readers cannot fall back to an aria-label, so
	// the accessible names ride along here.
	const breakdown = Object.entries(summary.byType)
		.map(([type, count]) => {
			const name = isReactionType(type)
				? `${REACTION_EMOJI[type]} ${m.reactionLabels[type]}`
				: type;
			return `${name}: ${displayValue(count)}`;
		})
		.join(" / ");
	const headline = weeklyHeadline(m, summary.total === 0 ? undefined : displayValue(summary.total));
	const pageUrl = `${origin}/subjects/${subject.id}`;
	return `<entry>
<id>${escapeXml(`${pageUrl}#${weekId}`)}</id>
<title>${escapeXml(`${subject.name} — ${weekId}`)}</title>
<link href="${escapeXml(pageUrl)}"/>
<updated>${updated}</updated>
<summary>${escapeXml(breakdown === "" ? headline : `${headline} ${breakdown}`)}</summary>
</entry>`;
}

export function loader(args: Route.LoaderArgs) {
	// Read-only representation: served through the edge cache (URL-keyed).
	const { ctx } = args.context.get(appContext);
	return edgeCachedByUrl(args.request, ctx, () => Promise.resolve(produce(args)));
}

async function produce({ request, params, context }: Route.LoaderArgs) {
	const { env } = context.get(appContext);
	const subject = await loadActiveSubject(env.DB, params.id);
	const { origin } = new URL(request.url);
	const now = new Date();
	const weeks = recentWeeks(now, FEED_WEEK_COUNT);
	// One contiguous slice of the counters, bucketed into weeks here — eight
	// per-week queries would scan the same rows in eight statements.
	const first = weeks.at(0)?.start ?? "";
	const last = weeks.at(-1)?.end ?? "";
	const range = first <= last ? { start: first, end: last } : { start: last, end: first };
	const days = await countsByDay(env.DB, subject.rowid, range);
	const entries = weeks
		.map((week) => {
			const summary = { total: 0, byType: {} as Record<string, number> };
			for (const row of days) {
				if (row.day < week.start || row.day > week.end) {
					continue;
				}
				summary.total += row.count;
				summary.byType[row.type] = (summary.byType[row.type] ?? 0) + row.count;
			}
			if (summary.total === 0) {
				return "";
			}
			const updated = `${week.end}T00:00:00Z`;
			return weekEntry(
				subject,
				origin,
				isoWeekId(new Date(`${week.start}T00:00:00Z`)),
				summary,
				updated,
			);
		})
		.filter((entry) => entry !== "")
		.toReversed()
		.join("\n");
	const feedUrl = `${origin}/subjects/${subject.id}/feed`;
	const body = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
<id>${escapeXml(feedUrl)}</id>
<title>${escapeXml(`${subject.name} — Negirau`)}</title>
<link href="${escapeXml(feedUrl)}" rel="self"/>
<link href="${escapeXml(`${origin}/subjects/${subject.id}`)}"/>
<updated>${now.toISOString()}</updated>
${entries}
</feed>
`;
	return cachedResponse(body, "application/atom+xml; charset=utf-8", 3600);
}
