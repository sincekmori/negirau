// GET /subjects/:id/feed — the pull-only substitute for email notifications,
// consumable from any feed reader or Slack RSS integration. One entry whose id
// rolls with the ISO week: readers see a fresh entry each week, and its body
// carries the all-time display values — the only aggregation any surface
// shows. No personal data changes hands.

import { appContext } from "~/lib/context";
import { isoWeekId } from "~/lib/dates";
import { displayValue } from "~/lib/display-value";
import { DEFAULT_LOCALE, messages, totalHeadline } from "~/lib/i18n";
import { isReactionType, REACTION_EMOJI } from "~/lib/reactions";
import { countsSummary } from "~/lib/server/db";
import { edgeCachedByUrl } from "~/lib/server/edge-cache";
import { cachedResponse, escapeXml, loadActiveSubject } from "~/lib/server/route-helpers";

import type { Route } from "./+types/feed";

// Locale-fixed on purpose: the feed is machine-polled hourly and shares one
// cache entry per URL; per-locale variants would fragment that cache.
const m = messages(DEFAULT_LOCALE);

export function loader(args: Route.LoaderArgs) {
	// Read-only representation: served through the edge cache (URL-keyed).
	const { ctx } = args.context.get(appContext);
	return edgeCachedByUrl(args.request, ctx, () => produce(args));
}

async function produce({ request, params, context }: Route.LoaderArgs) {
	const { env } = context.get(appContext);
	const subject = await loadActiveSubject(env.DB, params.id);
	const { origin } = new URL(request.url);
	const now = new Date();
	const summary = await countsSummary(env.DB, subject.rowid);
	const pageUrl = `${origin}/subjects/${subject.id}`;
	const feedUrl = `${pageUrl}/feed`;
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
	const headline = totalHeadline(m, summary.total === 0 ? undefined : displayValue(summary.total));
	const weekId = isoWeekId(now);
	// Nothing yet → no entries: a subscriber hears from the feed only once
	// there is something to hear about.
	const entry =
		summary.total === 0
			? ""
			: `<entry>
<id>${escapeXml(`${pageUrl}#${weekId}`)}</id>
<title>${escapeXml(`${subject.name} — ${weekId}`)}</title>
<link href="${escapeXml(pageUrl)}"/>
<updated>${now.toISOString()}</updated>
<summary>${escapeXml(`${headline} ${breakdown}`)}</summary>
</entry>`;
	const body = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
<id>${escapeXml(feedUrl)}</id>
<title>${escapeXml(`${subject.name} — Negirau`)}</title>
<link href="${escapeXml(feedUrl)}" rel="self"/>
<link href="${escapeXml(pageUrl)}"/>
<updated>${now.toISOString()}</updated>
${entry}
</feed>
`;
	return cachedResponse(body, "application/atom+xml; charset=utf-8", 3600);
}
