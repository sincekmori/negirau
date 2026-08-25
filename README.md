# Negirau

[![CI](https://github.com/sincekmori/negirau/actions/workflows/ci.yml/badge.svg)](https://github.com/sincekmori/negirau/actions/workflows/ci.yml)
[![npm negirau](https://img.shields.io/npm/v/negirau?label=npm%20negirau)](https://www.npmjs.com/package/negirau)
[![npm negirau-mcp](https://img.shields.io/npm/v/negirau-mcp?label=npm%20negirau-mcp)](https://www.npmjs.com/package/negirau-mcp)
[![PyPI negirau](https://img.shields.io/pypi/v/negirau?label=PyPI%20negirau)](https://pypi.org/project/negirau/)
[![Negirau](https://negirau.com/subjects/sincekmori/badge)](https://negirau.com/subjects/sincekmori)

日頃の担い手に、ねぎらいを。
Negirau (negirau.com) lets anyone send a one-tap, login-free appreciation to the people behind everyday work — fire stations, event crews, online services, open-source maintainers.

- No accounts, no user-generated text, no visitor data stored.
- Counts are shown exactly up to 100 and as "100+" beyond — by design, this service cannot become a ranking.
- Runs entirely on Cloudflare Workers + D1 within the free tier.

## Development

Prerequisites: [bun](https://bun.com/) (plus [pnpm](https://pnpm.io/) for `packages/client-ts` and `packages/mcp-server`, and [uv](https://docs.astral.sh/uv/) for `packages/client-py`).

```
bun install
cp .dev.vars.example .dev.vars
bun run db:migrate && bun run db:seed
bun run dev
```

See [AGENTS.md](AGENTS.md) for the full check list, architecture invariants, and gotchas.

## Repository layout

| Path                   | What                                                             | License       |
| ---------------------- | ---------------------------------------------------------------- | ------------- |
| `/` (server + web app) | React Router 7 app on Cloudflare Workers                         | AGPL-3.0-only |
| `packages/client-ts`   | TypeScript API client (npm), hand-written + spec contract tests  | Apache-2.0    |
| `packages/client-py`   | Python API client (PyPI), hand-written + spec contract tests     | Apache-2.0    |
| `packages/mcp-server`  | MCP server (npm), registers tools dynamically from the live spec | Apache-2.0    |
| `skills/negirau`       | Agent Skill (SKILL.md), generated from the route manifest        | Apache-2.0    |

Everything under `packages/` is held to the OpenAPI spec: both clients run spec-driven contract tests, `mcp-server` reads the live spec at startup, and `SKILL.md` is generated with a CI drift gate.

## Public API

Read-only, anonymous, CORS-open, based at `https://api.negirau.com/v1`.
The spec is served at [/v1/openapi.json](https://api.negirau.com/v1/openapi.json) and generated from the zod schemas at build time — it cannot drift from the implementation.
There are no bulk dumps and no ranking endpoints, on purpose: the lookup path is server-side search (`q=` on `/v1/subjects`) and bounded nearby search.

## License

Copyright (C) 2026 Shinsuke Mori.

The server and web app are licensed under [AGPL-3.0-only](LICENSE).
Client packages under `packages/` are licensed under Apache-2.0 (see each package's LICENSE).
The "Negirau" name and the heart-pin logo are not covered by these licenses.

## Attribution

- Map tiles: [OpenFreeMap](https://openfreemap.org/) © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors
