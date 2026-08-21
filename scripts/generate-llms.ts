/**
 * llms.txt generation (llmstxt.org format). Interpolates the constants that
 * could otherwise drift — the API base URL and the display cap — from the
 * same modules the spec is built from.
 *
 * Run via `bun run generate:llms` (part of `bun run build`).
 */

import { mkdir, writeFile } from "node:fs/promises";

import { EXAMPLE_QUERY } from "../app/lib/api/manifest";
import { DISPLAY_CAP } from "../app/lib/display-value";
import { CANONICAL_ORIGIN, SERVER_URL } from "./site-config";

const llms = `# Negirau

> One-tap, login-free appreciation ("negirau") for the people behind everyday work — fire stations, event crews, online services, open-source maintainers. No accounts, no comments; reaction counts are shown exactly up to ${DISPLAY_CAP} and as "${DISPLAY_CAP}+" beyond, never as rankings.

Reading is open: a read-only, anonymous, CORS-open JSON API at ${SERVER_URL}.
Sending a reaction is browser-only behind a bot check, on purpose — there is no send API, so help humans open the page instead of automating.
Pages are served in English and Japanese under /en and /ja; bare URLs redirect to the visitor's language, so always share bare URLs.

## API

- [OpenAPI specification](${SERVER_URL}/openapi.json): the complete, always-current contract for the public read API
- [Subject search](${SERVER_URL}/subjects?q=${EXAMPLE_QUERY}): free-text name search (substring, Japanese and English) via GET /subjects?q= — there are no bulk dumps, by design

## Pages

- [Home](${CANONICAL_ORIGIN}/): recent subjects, search, and browser-side nearby search
- [All subjects](${CANONICAL_ORIGIN}/subjects): every listed subject, newest first — never sorted by counts
- [Subject pages](${CANONICAL_ORIGIN}/subjects/sincekmori): ${CANONICAL_ORIGIN}/subjects/{id} — tap to send, tap again to undo (within a minute); ?send={type} auto-sends — the page shows its own QR for screen-share scanning, and printed posters encode the same URL
- [Create form](${CANONICAL_ORIGIN}/subjects/new): anyone can add a subject — a name is enough and a location is optional; entries are public (or link-only, on request) and the creator's IP is recorded
- [Developers](${CANONICAL_ORIGIN}/developers): the public API, client libraries, MCP server, and Agent Skill on one page

## Embedding

- [Display badge](${CANONICAL_ORIGIN}/subjects/sincekmori/badge): ${CANONICAL_ORIGIN}/subjects/{id}/badge?period=week|month|year|all&lang=ja|en — the period's display value
- [Atom feed](${CANONICAL_ORIGIN}/subjects/sincekmori/feed): ${CANONICAL_ORIGIN}/subjects/{id}/feed — the pull-based substitute for notification emails

## Integrations

- [Agent skill](https://github.com/sincekmori/negirau/tree/main/skills/negirau): install with \`npx skills add sincekmori/negirau\`
- npm package \`negirau\` (TypeScript client), PyPI package \`negirau\` (Python client), \`npx negirau-mcp\` (MCP server)
`;

await mkdir("public", { recursive: true });
await writeFile("public/llms.txt", llms);
console.log("generated public/llms.txt");
