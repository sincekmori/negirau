# AGENTS.md

## Overview

Negirau (negirau.com) lets anyone send a one-tap, login-free appreciation ("ねぎらい") to the people behind everyday work: fire stations, event crews, online services, open-source maintainers — anything worth thanking.
No user accounts, no user text, no visitor data; anyone can create a subject page, and the operator moderates daily after the fact — see the design decisions below.
Stack: React Router 7 (framework mode, react-router v8 APIs) on Cloudflare Workers via @cloudflare/vite-plugin, D1 (SQLite), Turnstile, MapLibre + OpenFreeMap.

## Local checks (mirror CI)

`bun run check` runs the whole battery locally: generate:openapi → lint → format:check → typecheck → test → build → a11y (needs the seeded local DB from the dev quickstart) → knip → check:drift (regenerate skills/negirau and fail on diff) → check:skill (Agent Skills spec validator, `skills-ref validate`) → typos.
CI (.github/workflows/ci.yml) runs the same pieces as separate steps (typos via the crate-ci/typos action as its own job):

```
bun install --frozen-lockfile
bun run generate:openapi
bun run lint
bun run format:check
bun run typecheck
bun run test
bun run build
bun run knip
bun run check:drift
```

Plus `typos` (crate-ci/typos; installed via Homebrew locally), the pnpm packages (`packages/client-ts`: `pnpm install --frozen-lockfile && pnpm run build && pnpm run test && pnpm run check`; `packages/mcp-server`: same minus test), and the Python client (`cd packages/client-py && uv sync --locked && uv run ruff check && uv run ruff format --check && uv run ty check && uv run pytest && uv build`; CI matrixes only pytest over all non-EOL CPython minors, the rest runs once on the floor).
Both clients' test suites are spec contract tests reading `public/v1/openapi.json`, so `bun run generate:openapi` must run first.

## Dev quickstart

```
cp .dev.vars.example .dev.vars   # Turnstile test keys; always-pass
bun run db:migrate               # local D1
bun run db:seed                  # the launch subjects (four chosen ids, three around Tokyo)
bun run dev                      # or: bun run build && bun run preview
```

There is no admin UI: the operator works directly on D1 (Cloudflare console or `wrangler d1 execute`) — status flips, removals, and operator-created subjects with chosen ids are all plain SQL.

## Architecture invariants — decisions, not defaults; do not "fix" them

- **Counts are display values.** Every public surface (UI, API, OGP, feed) shows the exact count up to 100 and "100+" beyond (the badge deliberately shows no count at all) — that is the only boundary. The single source of truth is `app/lib/display-value.ts`; unbounded exact counts stay operator-only (SQL).
- **No ranking surfaces.** No sorted count lists, no cross-subject comparison, no bulk dumps (they broke the 25 MiB asset limit at national scale and would have invited rankings); the lookup path is server-side search — FTS5 trigram in `migrations/0001_init.sql`, `q=` on `/v1/subjects`.
- **Subjects are abstract and self-serve.** A subject is a name, optionally with a location (lat/lng) — people and groups included. Anyone creates one at `/subjects/new` (Turnstile-gated, live immediately, UUID id); operators insert rows with chosen ids (e.g. `sincekmori`) via SQL — except `new`, which the create form URL owns (enforced by a CHECK constraint). There is no pre-registration, no external-namespace provisioning, and no existence verification — moderation is daily and after the fact (`status`: active → quarantined → removed). Creators may also mark a subject link-only (`listed = 0`): off every enumeration surface (search, listings, nearby, sitemap, noindex) but fully functional by URL — unlisted, not secret, and orthogonal to `status`.
- **Zero visitor data.** No user table, no email, no IP in logs. The one exception, by legal design: `subjects.created_ip` stores the creator's IP solely for abuse/legal traceability (takedown and disclosure requests), and NULL marks operator-created rows. Rate-limit counters live in Cloudflare bindings (volatile). GPS near-search (`app/lib/components/NearbyFinder.tsx`) queries the API from the geohash-cell CENTER (precision 5, ≈5 km quantization) and computes true distances in the browser — the precise position never leaves the device.
- **GET has no side effects.** QR direct send works via client JS POST behind Turnstile (`/subjects/{id}?send=heart` — the parameter names the reaction), never via GET — link-preview bots would inflate counts otherwise. Reload/duplicate protection is layered per subject × type × day: the device sent-log (localStorage) plus an HttpOnly `negirau_sent` cookie checked in `POST /subjects/{id}/reactions` (released again by undo). Each reaction type can be sent once per subject per day.
- **Subject writes are first-party page actions, excluded from the public OpenAPI spec on purpose.** `POST /subjects` creates (the collection page's action); `PATCH/DELETE /subjects/{id}` do NOT mutate — they queue update/delete requests into `subject_requests` (one live row per subject × kind, newer overwrites; the operator applies them via SQL in the daily review, then deletes the row). Reactions live under their subject too: `POST/DELETE /subjects/{id}/reactions` (a locale-free resource route). Every anonymous write path sits behind Turnstile; undo is the DELETE, authorized by a signed voucher from a verified send.
- **openapi.json is generated** (`scripts/generate-openapi.ts`) from `app/lib/api/schemas.ts` + `app/lib/api/manifest.ts`. Never hand-edit a spec file; extend the schemas/manifest instead.
- **The public API base is `https://api.negirau.com/v1`**: routes are registered under `/v1` in `app/routes.ts` and the spec asset lives at `public/v1/openapi.json`; spec paths are prefix-free (relative to the server URL) and the generators own the translation.
- **Site identity lives in wrangler.jsonc vars, never in source.** `SITE_DOMAIN` (e.g. `negirau.com`) and `CONTACT_EMAIL` are the wrangler vars; `app/lib/site.ts` derives the page origin (`https://{domain}`), the API origin (`https://api.{domain}`), and the bare host from that one value via URL objects. The worker derives them once per request into `appContext.site`; the build-time generators read the same wrangler.jsonc through `scripts/site-config.ts` (wrangler's `unstable_readConfig`); robots.txt is a worker route for the same reason. A self-hosting fork edits wrangler.jsonc — the file it must edit anyway for routes/D1/Turnstile — and touches no TypeScript. Do not re-hardcode origins or the contact address; user-facing absolute URLs keep riding the request origin, and SKILL.md is written against `{ORIGIN}`/`{API}` placeholders with the configured instance as default.
- **Rate-limit bindings are optional at runtime.** Their free-plan availability is unconfirmed; `app/lib/server/rate-limit.ts` must keep working when the bindings are absent (the WAF rule is the fallback layer).
- **Removal ends in a real delete.** `status` moves active → quarantined → removed (the two-stage takedown), and `ops purge` then deletes the row for real; a deletion request must not leave the name behind, since a subject name can itself be personal data. Both child tables carry `ON DELETE CASCADE`, which is what makes that safe: SQLite reuses a freed rowid, so an orphaned counter would resurface as some later subject's reactions. Do not drop the cascade in favour of hand-written multi-table deletes.
- **Reaction counters are day-granular** (`reaction_counts` PK subject/type/day) to allow surgical rollback of attacked days. Do not "optimize" into weekly totals.
- **Zero layout shift for transient UI (CLS discipline).** Ephemeral state must never reflow surrounding content: no element may be inserted into or removed from the normal flow as feedback (that is Cumulative Layout Shift, and it reads as jank). Overlay ephemeral surfaces instead — popovers, portals, absolutely positioned dropdowns anchored to their trigger — keep confirmations inside fixed-size affordances (icon swaps within a fixed-width button), and reserve space for anything that genuinely must toggle inline. Applies to search-result lists, copy confirmations, validation notes, and menus; toasts do not exist in this UI at all.
- **Every query is bounded.** D1 bills scanned rows, so no query's cost may scale with table size past its LIMIT: search joins the FTS index ordered by its rowid (early termination), near-search runs on a lat/lng index inside a bounding box with a row cap, listings paginate by keyset, sitemaps page by rowid blocks.

## Stack gotchas

- `wrangler types` output depends on flags: always go through `bun run gen` (`--strict-vars=false`), or `REACTIONS_ENABLED === "false"` comparisons break on literal types.
- Request context (env/ctx/locale) flows through react-router v8's `createContext` (`app/lib/context.ts`), filled once per request in `workers/app.ts`; loaders read it with `context.get(appContext)`.
- The local workerd caps `compatibility_date` (currently 2026-08-08); keep wrangler.jsonc and vitest.config.ts in sync.
- `workers-og` stays a **dynamic** import inside the OG route; the Cloudflare vite plugin resolves its .wasm modules in the ssr environment (never add `ssr.external` — the plugin rejects it).
- maplibre-gl v6 loads its map worker from a separate file: `setWorkerUrl` with a `?worker&url` import is mandatory (production 404s without it), the import lives in a `.client.ts` module, and vite.config's `pruneClientWorkerChunks` keeps the re-emitted worker chunk out of the server upload.
- Workers' HTMLRewriter global `Element` type merges into DOM `Element`: use `appendChild`, not `append`, in client code (see `app/lib/client/turnstile.ts`).
- vitest runs in the workers pool (`@cloudflare/vitest-pool-workers`, vitest 4 plugin API `cloudflareTest()`); the old `fetchMock` from `cloudflare:test` is gone — stub `fetch` with `vi.stubGlobal`.
- `.dev.vars` ships Cloudflare's public Turnstile _test_ keys (always pass). Production keys are Worker secrets, never in the repo.
- Locale lives in the URL path: pages are served at `/ja/...` and `/en/...` (the `:locale?` param in `app/routes.ts`, validated in the site layout's loader), so caches are purely URL-keyed and hreflang alternates exist. Bare paths — shares, printed QR codes — 302-redirect via cookie → Accept-Language (resolved in `workers/app.ts`; redirect responses are no-store); share/OG/QR URLs stay bare on purpose so recipients land in their own language. Locale-free endpoints (`/subjects/{id}/feed`, `/subjects/{id}/og`, `/subjects/{id}/badge`, `/og/site`) live outside the locale tree. UI strings live only in `app/lib/i18n/` (typed `Messages` — adding a key breaks the build until every locale has it).
- The contact address comes from wrangler.jsonc `vars.CONTACT_EMAIL` (site identity, not source) and reaches pages via `appContext`; only the contact page renders it, as a mailto with the [Negirau] subject prefix — never restate the address elsewhere.
- Generated-and-committed artifacts: `skills/negirau/` (`bun run generate:skill`, drift-checked in CI): SKILL.md carries philosophy/GUI/limits prose while `references/openapi.json` is a snapshot of the served spec (both built from `scripts/openapi-document.ts`, so the generator runs standalone); the frontmatter `name` must equal the folder name per the Agent Skills spec, which is what makes `npx skills add sincekmori/negirau` work. `public/llms.txt` is generated too (`bun run generate:llms`, part of `bun run build`, not committed), and the skill's `references/` also carries verbatim copies of both client READMEs. The clients are NOT generated: both are hand-written around resource namespaces (`client.subjects.list(...)`), a typed error hierarchy rooted at `NegirauError`, and retries with exponential backoff, with spec-driven contract tests (`packages/client-ts/tests/contract.test.ts`, `packages/client-py/tests/test_contract.py`) that load openapi.json and fail on any drift — operation coverage, request paths and parameter names, and payload parsing.

## Style / prose

- Tooling: bun everywhere except the npm-published packages (`packages/client-ts`, `packages/mcp-server`: pnpm) and the Python client (`packages/client-py`: uv + ruff `select ALL` + ty). oxlint for TS/JS; oxfmt is the ONE formatter for everything, packages included — indentation comes from .editorconfig (tabs for code, spaces for JSON/YAML/Markdown/TOML/SQL), which oxfmt honors because `.oxfmtrc.json` deliberately sets no indent options; .gitignore and lockfiles are respected automatically, so ignorePatterns lists only committed exceptions (vendored ui, generated snapshots and CHANGELOGs). Styling is Tailwind v4 (CSS-first config in `app/lib/app.css`: the palette lives in custom properties switched by the `dark` class — next-themes owns that class — and feeds both the house tokens (`brand`, `ink`, `paper`…) and the shadcn semantic aliases; no tailwind.config file); UI controls are shadcn/ui components vendored under `app/lib/components/ui` (excluded from oxlint/oxfmt/knip as upstream code — the pink is `brand`, never shadcn's `accent`, which is the hover wash); every disabled lint rule carries a rationale comment in .oxlintrc.json.
- English for all code, comments, configs, commits. UI copy is ja/en via `app/lib/i18n`.
- Japanese UI copy uses standard (常用) kanji for content words (作る, 探す, 一つ, 置く, 大丈夫, 頑張る); kana stays for auxiliaries and formal nouns (…してください, …できません) and for the brand word ねぎらい (never 労い — it misreads as いたわる).
- Markdown: one sentence per line (Semantic Line Breaks).
- UTF-8, LF, tabs for TS/TSX, spaces for JSON/YAML (.editorconfig is authoritative).
- Licensing: repo root AGPL-3.0-only; `packages/client-ts` is Apache-2.0 (see LICENSE files and README license map).

## Commits & autonomy boundary

- Conventional Commits, imperative, single sentence on a single line, no body.

## Releases

- One release-please manifest (`release-please-config.json` + `.release-please-manifest.json`) covers all three publishable packages; `.github/workflows/release.yml` opens per-package release PRs from conventional commits and publishes on merge via OIDC trusted publishing (npm for client-ts/mcp-server, PyPI for client-py — no long-lived tokens).
- Deliberate deviation from the house "npm → changesets" default: the bun-managed root has no npm workspace for changesets to walk, and one flow covering node + python beats two.
- Version bumps and changelogs derive from commit types — write commits accordingly.
- Version taxonomy — two axes only:
  (1) the `/v1` URL prefix is the compatibility promise; it changes only on a breaking API redesign (a v2 is added alongside v1, never switched in place).
  (2) everything else shares ONE project version (fixed/lockstep versioning, Angular-style): root package.json is the canonical copy, and release-please's single root component fans it out via `extra-files` to both clients, mcp-server, and server.json (×2); openapi.json `info.version` and the skill frontmatter are generated from root package.json at build time, and the committed spec snapshot under `skills/negirau/references/` carries the same number (the release-sync workflow re-locks uv and regenerates all of `skills/negirau/` on release branches, not just SKILL.md).
  Equal numbers everywhere with no rules to read; unchanged packages ship empty releases by design.
  `tests/versions.test.ts` asserts total equality continuously — a manual edit to any one field fails CI.
  Any conventional commit merged to main advances the version (docs/chore → patch, feat → minor, breaking → minor while pre-1.0 via `bump-minor-pre-major`); 1.0.0 is only ever taken deliberately, with a `Release-As: 1.0.0` commit.
  Client↔spec compatibility is guaranteed by the contract tests (operation coverage both directions), not by comparing version numbers.
  Merge release PRs promptly after contract changes: the deployed spec serves new content under the old number until the merge.

## Where to look first

| Intent                        | Entry point                                                 |
| ----------------------------- | ----------------------------------------------------------- |
| Display-value cap rule        | `app/lib/display-value.ts`                                  |
| Reaction write flow           | `app/lib/server/react.ts`                                   |
| Subject creation flow         | `app/lib/server/create-subject.ts`                          |
| Update/delete request flow    | `app/lib/server/subject-request.ts` + `app/routes/edit.tsx` |
| D1 queries                    | `app/lib/server/db.ts`                                      |
| Public API handlers           | `app/routes/v1.*.ts` + `app/routes.ts`                      |
| API contract (spec source)    | `app/lib/api/schemas.ts`, `app/lib/api/manifest.ts`         |
| DB schema                     | `migrations/0001_init.sql`                                  |
| Subject page + QR send        | `app/routes/subject.tsx`                                    |
| Badge (identity, count-free)  | `app/lib/server/badge.ts`, `app/routes/badge.ts`            |
| Maps (subject page, picker)   | `app/lib/components/SubjectMap.tsx`, `LocationPicker.tsx`   |
| Ops levers (kill switch etc.) | wrangler.jsonc vars + D1 SQL                                |

## Self-service dev affordances

- Everything runs locally without Cloudflare credentials: local D1 via wrangler, Turnstile test keys, seeded data (`bun run db:seed`).
- `bun run preview` serves the real Worker build at http://localhost:4173; the OG image and wasm path only work under preview (not `bun run dev`).
- `vite preview` serves whatever the deploy-config redirect (`.wrangler/deploy/config.json`) points at — i.e. the LAST build. Dev-environment builds therefore go to `build-dev/` (react-router.config.ts switches on `CLOUDFLARE_ENV`) and `deploy:dev` ends with a default build, so preview never opens the dev D1 binding (symptom: `no such table: subjects`).
- Reset local DB: delete `.wrangler/state` and re-run migrate/seed. Miniflare keys its local file by `database_id`, so editing that id in wrangler.jsonc orphans the old local database too (same `no such table: subjects` symptom) — re-run migrate/seed after any id change.
- Three test layers before production: (1) `bun run dev` — vite with miniflare bindings, fastest loop; (2) `bun run preview` — the built Worker in real workerd, locally; (3) `bun run deploy:dev` — the `dev` wrangler environment on real Cloudflare infra (worker `negirau-dev` at https://dev.negirau.com — never the production domains — own D1 `negirau-dev`, and a real Turnstile widget scoped to the dev hostnames). One-time setup: `wrangler d1 create negirau-dev` + paste the id into wrangler.jsonc `env.dev`, `wrangler d1 migrations apply negirau-dev --env dev --remote`, and `wrangler secret put TURNSTILE_SECRET_KEY --env dev`.
- Production is `bun run deploy` (build, then `wrangler deploy` — never a bare `wrangler deploy`, which follows whichever build ran last). Its one-time setup mirrors dev and is already done in wrangler.jsonc: D1 `negirau` and a managed Turnstile widget scoped to negirau.com. What stays manual, outside the repo: `wrangler secret put TURNSTILE_SECRET_KEY`, Email Routing enabled on the zone with CONTACT_EMAIL verified as a destination (the daily nudge silently fails otherwise), and the WAF rate-limit rule — layer 2 of the anti-abuse stack, and the only layer that is certain to exist on the free plan.

- `bun run smoke [base-url] [--write]` runs an end-to-end check against any layer (read-only by default; `--write` sends one reaction — local/dev only).
- `bun run ops <review|apply|delete|finalize|restore|counts|purge>` wraps the operator's daily-review SQL via wrangler (`--env local|development|production`, default development — production is always explicit). A production cron (17:00 JST) mails the operator via the Email Routing send binding when the queue or the newest-subjects list is non-empty; one-time setup: enable Email Routing on the zone and verify CONTACT_EMAIL as a destination.
- `bun run test:e2e` runs the Playwright journeys (locale negotiation, reaction+undo+QR, subject creation, search, nearby search) against the same built-and-seeded setup as a11y; it starts its own preview server. Reaction tests undo what they send, so local counts stay put.
  All specs extend `e2e/fixtures.ts`: an auto fixture fails any test whose page hits a same-origin 4xx/5xx on a static asset (script/stylesheet/worker/…) or throws an uncaught exception — the net that catches "the build forgot a file" bugs UI assertions miss.
- `bun run a11y` audits the built site with axe-core at the strictest automatable level (WCAG 2.0/2.1 A+AA, WCAG 2.2 AA, the automatable AAA rules incl. 7:1 enhanced contrast, and axe best practices; both locales × light/dark) against seeded local data; CI runs it as its own job. One-time local setup: `bunx playwright install chromium`. The palette in `app/lib/app.css` is tuned so every text stop clears 7:1 — check contrast before adding colors.
