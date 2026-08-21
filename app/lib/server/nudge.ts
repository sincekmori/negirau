/**
 * The daily-review nudge (cron, 17:00 JST): when the request queue or the
 * last day's new subjects are non-empty, mail the operator via the Email
 * Routing send binding — free to the verified CONTACT_EMAIL destination, no
 * external service. Silent when there is nothing to review.
 */

import { EmailMessage } from "cloudflare:email";

import { reactionRowsGauge, reviewQueueCounts, ROLLUP_WATCH_THRESHOLD } from "~/lib/server/db";

export async function nudgeOperator(env: Env): Promise<void> {
	const counts = await reviewQueueCounts(env.DB);
	if (counts.requests === 0 && counts.fresh === 0) {
		return;
	}
	// Rides along on mails the queue already triggers; costs 1 scanned row.
	const gauge = await reactionRowsGauge(env.DB);
	const gaugeNote = gauge >= ROLLUP_WATCH_THRESHOLD ? " — consider the counts rollup" : "";
	const sender = `ops@${env.SITE_DOMAIN}`;
	// ASCII-only headers and body keep the raw RFC 5322 message trivial.
	const raw = [
		`From: Negirau <${sender}>`,
		`To: ${env.CONTACT_EMAIL}`,
		`Subject: [Negirau] Daily review: ${counts.fresh} new, ${counts.requests} request(s)`,
		`Date: ${new Date().toUTCString()}`,
		"Content-Type: text/plain; charset=utf-8",
		"",
		`New subjects (24h): ${counts.fresh}`,
		`Pending requests:   ${counts.requests}`,
		`Reaction rows:      ~${gauge}${gaugeNote}`,
		"",
		"bun run ops review --env production",
		"",
	].join("\r\n");
	await env.NOTIFY_EMAIL.send(new EmailMessage(sender, env.CONTACT_EMAIL, raw));
}
