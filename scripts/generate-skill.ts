/**
 * Agent Skill generation. SKILL.md carries what the spec cannot:
 * the philosophy (why the display cap, why no rankings, why no send API), the
 * GUI flows, intended integrations, and hard limits. The full API contract
 * rides along as references/openapi.json — a snapshot of the same document
 * the server serves — so the skill follows progressive disclosure instead of
 * duplicating endpoint prose.
 *
 * The body is written against `{ORIGIN}` / `{API}` placeholders with the
 * configured instance as the default, so one skill serves the official site
 * and any self-hosted fork alike.
 *
 * The output lives at skills/negirau/ (SKILL.md name matches the folder, as
 * the Agent Skills spec requires), so `npx skills add sincekmori/negirau`
 * finds it. Run via `bun run generate:skill`; CI fails when the committed
 * files drift.
 */

import { copyFile, mkdir, writeFile } from "node:fs/promises";

import { format } from "oxfmt";

import { API_OPERATIONS, EXAMPLE_QUERY, specPath } from "../app/lib/api/manifest";
import { DISPLAY_CAP } from "../app/lib/display-value";
import { REACTION_EMOJI } from "../app/lib/reactions";
// The one project version; root package.json is the canonical copy (AGENTS.md "Releases").
import { version as PROJECT_VERSION } from "../package.json";
import { OPENAPI_JSON } from "./openapi-document";
import { CANONICAL_ORIGIN, SERVER_URL, SITE_HOST } from "./site-config";

const operationIndex = API_OPERATIONS.map(
	(operation) => `| \`GET ${specPath(operation)}\` | ${operation.summary} |`,
).join("\n");

// One sentence per line; the folded YAML scalar joins them with spaces.
const DESCRIPTION_SENTENCES = [
	`Work with Negirau (${SITE_HOST}), the login-free one-tap appreciation service for the people behind everyday work — fire stations, event crews, online services, open-source maintainers.`,
	`Use this whenever a task touches Negirau in any way: reading subjects or reaction display values from the public API, embedding a badge or an Atom feed, linking or printing a thank-you page, creating a new subject, or explaining why exact counts above ${DISPLAY_CAP}, rankings, and API-driven sends do not exist (deliberate design, not gaps).`,
	`Also applies when the user says "send thanks to X" or "how much appreciation does X have" without naming Negirau.`,
	`Works against any self-hosted Negirau instance; pass its origin as the argument.`,
];

// The Agent Skills spec caps description at 1024 characters; check the joined
// string the YAML folding produces.
if (DESCRIPTION_SENTENCES.join(" ").length > 1024) {
	throw new Error("SKILL.md description over the 1024-character cap");
}

// The Agent Skills spec has no top-level version field; versions go under the
// free-form metadata map.
const skill = `---
name: negirau
description: >-
  ${DESCRIPTION_SENTENCES.join("\n  ")}
license: Apache-2.0
metadata:
  version: "${PROJECT_VERSION}"
---

# Negirau

One-tap, login-free appreciation ("ねぎらい") for the people behind everyday work.
A visitor opens a subject page, taps one reaction, and is done — no account, no comment box, no personal data collected.

## Instance

Every URL below is a template over two values:

- \`{ORIGIN}\` — the page origin.
  Default: \`${CANONICAL_ORIGIN}\`
- \`{API}\` — the read-API base.
  Default: \`${SERVER_URL}\`

The defaults are the instance this skill ships with; use them unless the task points elsewhere.
Negirau is self-hostable, and another instance can be named three ways: an argument passed when invoking this skill directly (verbatim value, blank when absent: "$ARGUMENTS"), the user naming an instance in prose, or a subject URL carrying a different host.
In any of those cases set \`{ORIGIN}\` to that origin (e.g. \`https://thanks.example.org\`), set \`{API}\` to \`https://api.{that host}/v1\`, and keep everything else identical.

## The philosophy — constraints, not gaps

The design goal is gratitude that stays visible without ever becoming a metric.
Every rule below is deliberate; do not work around them or present them as missing features.

- **Counts are capped.**
  Every public surface shows a count exactly up to ${DISPLAY_CAP} and as \`"${DISPLAY_CAP}+"\` beyond — that is the only boundary, and unbounded exact numbers never leave the server.
- **No rankings.**
  There is no sorted-by-count listing, no cross-subject comparison, and no bulk dump to sort.
  Do not assemble leaderboards out of per-subject reads; that defeats the design.
- **Visitors are never identified.**
  No accounts, no user-written text, no visitor data.
  The site's GPS nearby search queries from a ~5 km-quantized point and computes true distances in the browser; a precise position never leaves the visitor's device.
- **Subjects are abstract.**
  A subject is just a name, optionally with a location — a person, a team, an event, a service, anything worth thanking.
  Anyone can create one; the operator moderates daily after the fact.
- **Reads have no side effects.**
  Opening, prefetching, or link-previewing any URL records nothing; a send is always an explicit \`POST\` behind a bot check.

## Reading data (public API)

Base URL \`{API}\` — read-only \`GET\`, anonymous, no key, CORS-open, JSON.

\`\`\`
curl "{API}/subjects?q=${EXAMPLE_QUERY}&limit=5"
\`\`\`

| Operation | What it does |
| --- | --- |
${operationIndex}

For request/response shapes, read [references/openapi.json](references/openapi.json) (snapshot, version ${PROJECT_VERSION}).
When the network is available prefer the live contract — it is always current even when this skill is stale:

\`\`\`
GET {API}/openapi.json
\`\`\`

## Sending appreciation — browser only, by design

There is intentionally **no send API**: every anonymous write sits behind Cloudflare Turnstile in a real browser, because scripts and link-preview bots would otherwise inflate counts.
Never try to automate a send; help the human open the page instead.

- Link to \`{ORIGIN}/subjects/{id}\`.
  Bare URLs redirect to the visitor's language (\`/en/…\` or \`/ja/…\`), so always share the bare form.
- The page offers a ${Object.keys(REACTION_EMOJI).length}-emoji reaction palette (${Object.values(REACTION_EMOJI).join(" ")}) — deliberately captionless, so the feeling stays the sender's own; one tap sends, tapping the pressed emoji again within about a minute takes it back, and each device can send each emoji once per subject per day.
- \`{ORIGIN}/subjects/{id}?send={type}\` auto-sends that reaction on open — the subject page itself shows a QR for a chosen reaction (screen-share it and a room can scan and send on the spot), and printed posters encode the same URL.
  It is still a client-side POST behind Turnstile, so scanning cannot be faked by fetching the URL.

## Embedding

- Badge (the period's display value, e.g. for a README): \`{ORIGIN}/subjects/{id}/badge?period=week|month|year|all&lang=ja|en\` — embed it behind a link to \`{ORIGIN}/subjects/{id}\`; there is deliberately no send badge, so an embedded click never sends by itself
- Atom feed (the pull-based substitute for notification emails): \`{ORIGIN}/subjects/{id}/feed\`
- Subject pages ship OGP images: pasting a link into chat or social media renders a card, and — per the no-side-effect rule — never counts as a send.

## Adding a subject

Point people at the create form: \`{ORIGIN}/subjects/new\` (bare URL; redirects to their language).
A name is all it takes; a location is optional.
The form also offers a link-only visibility: a link-only subject never appears in search, listings, nearby search, or sitemaps — only people holding the URL reach it (useful for team-internal thanks).
Warn the human that everything entered is published for anyone to see (link-only means unlisted, not private), and that the creator's IP address is recorded for abuse and legal traceability (the form says so too).
The subject is live immediately and gets a UUID id; the operator moderates daily after the fact.

## Client libraries

Prefer the official clients over hand-rolled fetch/curl when writing code — they carry retries, typed errors, and are contract-tested against the spec.
They default to \`${SERVER_URL}\`; for another instance pass \`{API}\` explicitly (\`baseURL\` in TypeScript, \`base_url\` in Python, the \`NEGIRAU_BASE_URL\` env var for the MCP server).

\`\`\`ts
// npm install negirau
import { Negirau } from "negirau";

const client = new Negirau(); // or: new Negirau({ baseURL: "{API}" })
const page = await client.subjects.list({ q: "${EXAMPLE_QUERY}", limit: 5 });
const reactions = await client.subjects.reactions.retrieve(page.subjects[0].id);
console.log(reactions.total); // a display value like "${DISPLAY_CAP}+"
\`\`\`

\`\`\`python
# pip install negirau
from negirau import Negirau

client = Negirau()  # or: Negirau(base_url="{API}")
page = client.subjects.list(q="${EXAMPLE_QUERY}", limit=5)
print(client.subjects.reactions.retrieve(page.subjects[0].id).total)
\`\`\`

Full usage — near search, error hierarchy, retries, async — lives in [references/client-ts.md](references/client-ts.md) and [references/client-py.md](references/client-py.md) (verbatim copies of the package READMEs).
For MCP-capable hosts, \`npx negirau-mcp\` exposes the read API as tools.

## Scenario: "I want to thank X"

The end state is always a URL the human opens — never an API call.
Assemble it like this:

1. **Resolve the id.**
   - Search by name: \`GET {API}/subjects?q={name}\` (or \`client.subjects.list({ q })\`) — substring match, Japanese and English; the \`near\` filter composes with it.
   - If nothing matches, point the human at \`{ORIGIN}/subjects/new\` — they can add the subject themselves in seconds.
2. **Hand back the bare URL** \`{ORIGIN}/subjects/{id}\` and tell the human to tap a reaction there (tapping again undoes it for about a minute; each type once per subject per device per day).
3. **Pick the URL variant for the context:**
   - \`{ORIGIN}/subjects/{id}?send=heart\` — one-tap: sends the heart on open, right for "make it as easy as possible".
   - \`{ORIGIN}/subjects/{id}/poster\` — a printable poster page with that QR baked in.
   - Verifying the id first costs one \`GET {API}/subjects/{id}\` and spares the human a dead link.

## Limits

- There are no bulk dumps (deliberately: they invited rankings and broke at national scale); enumerate via \`q\`/filters + cursor pagination, and never assemble count leaderboards from per-subject reads.
- \`q\` works from 1 character: 1-2 characters match as a name prefix (single page), 3+ as a substring (trigram index width); not fuzzy.
- Link-only subjects never appear in search or listings; \`GET {API}/subjects/{id}\` still resolves them, so a subject you cannot find may still exist — ask the human for its URL instead of concluding it is missing.
- Reaction aggregation accepts an ISO week (\`period=2026-W33\`), a month (\`2026-08\`), a year (\`2026\`), or \`all\`.
- Writes are rate-limited per IP and per subject; abusive days can be rolled back server-side, so a display value may occasionally go down.
- The reaction POST endpoint is first-party and absent from openapi.json on purpose — that absence is not an omission to report.
- UI languages are English and Japanese only; the API itself is language-neutral.
`;

await mkdir("skills/negirau/references", { recursive: true });
// Format in memory with the pinned oxfmt (the repo's formatter). The CLI
// ignores skills/negirau, so this pass is what keeps the committed file in
// the formatter's normal form regardless of how the template is written.
const formatted = await format("skills/negirau/SKILL.md", skill, { useTabs: false, tabWidth: 2 });
if (formatted.errors.length > 0) {
	throw new Error(`SKILL.md failed to format: ${formatted.errors[0]?.message}`);
}
await Promise.all([
	writeFile("skills/negirau/SKILL.md", formatted.code),
	writeFile("skills/negirau/references/openapi.json", OPENAPI_JSON),
	// The client docs are verbatim copies of the published package READMEs —
	// one source of truth, kept in sync by the CI drift check.
	copyFile("packages/client-ts/README.md", "skills/negirau/references/client-ts.md"),
	copyFile("packages/client-py/README.md", "skills/negirau/references/client-py.md"),
]);
console.log(
	`generated skills/negirau/ (SKILL.md, ${API_OPERATIONS.length}-operation spec snapshot, client docs)`,
);
