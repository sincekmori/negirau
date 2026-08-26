# Changelog

## [0.3.0](https://github.com/sincekmori/negirau/compare/v0.2.0...v0.3.0) (2026-08-26)


### ⚠ BREAKING CHANGES

* sum all time everywhere — the period concept leaves the public API (no parameter, no response field), the subject page, the OG card, and the feed, whose one entry now rolls with the ISO week while carrying the all-time values; period.ts shrinks to dates.ts with the day key and the week id, and countsSummary loses its range because there is only one aggregation left to ask for

### Features

* grow the subject page's send QR ([a7d5604](https://github.com/sincekmori/negirau/commit/a7d56040569412c9278d8cf25781b2e9f76e6644))
* grow the subject page's send QR from 112px to 144px and let it own the card width, so a shared screen scans from further across the room ([d7a23ec](https://github.com/sincekmori/negirau/commit/d7a23ecbe0630495eed13e24ea27f331e1a35d64))
* redesign the badge as a count-free identity mark ([0ef18e5](https://github.com/sincekmori/negirau/commit/0ef18e551f923ce196a772316b86eb10814c632f))
* redesign the badge as a count-free identity mark — {icon} Negirau | {subject.name} — because an embedded number goes stale in third-party caches and never said whose badge it was; the period and lang parameters lose their meaning and are ignored rather than rejected so URLs already embedded elsewhere keep resolving ([09d70b5](https://github.com/sincekmori/negirau/commit/09d70b5672e00f014e2636a547667ea8404f31fc))
* sum all time everywhere — the period concept leaves the public API (no parameter, no response field), the subject page, the OG card, and the feed, whose one entry now rolls with the ISO week while carrying the all-time values; period.ts shrinks to dates.ts with the day key and the week id, and countsSummary loses its range because there is only one aggregation left to ask for ([17f5aca](https://github.com/sincekmori/negirau/commit/17f5acad140997d80cd03dd00f4843b0d4496782))


### Bug Fixes

* speak English in every code example ([9036b0f](https://github.com/sincekmori/negirau/commit/9036b0fd7b8c5290adbd1f7fd76ea7093a4ef308))
* speak English in every code example — the clients' docs, docstrings, contract-test samples, and the smoke search all standardise on the library example, while the Japanese that stays is the UI copy and the FTS test data whose whole point is being Japanese ([30e6d8b](https://github.com/sincekmori/negirau/commit/30e6d8b0fe76c3879a461064271ab2298f2b0189))

## [0.2.0](https://github.com/sincekmori/negirau/compare/v0.1.1...v0.2.0) (2026-08-22)


### Features

* end a removal with a real delete ([92834fd](https://github.com/sincekmori/negirau/commit/92834fd5fa931b6ce38ad2d7bea4b6421f0be9dd))
* end a removal with a real delete — ops purge drops the row for good, and ON DELETE CASCADE takes its counters and queued requests with it so a reused rowid can never inherit orphans ([d7e553f](https://github.com/sincekmori/negirau/commit/d7e553fa9bb5d5adc09a960095a4f7c192610765))

## [0.1.1](https://github.com/sincekmori/negirau/compare/v0.1.0...v0.1.1) (2026-08-21)


### Bug Fixes

* keep the generated root changelog out of the formatter, surface wrangler failures the ops CLI was swallowing, and cut the MCP manifest description to the registry's cap before a release can half-land on it ([4437da3](https://github.com/sincekmori/negirau/commit/4437da3123c5da736f11dd3fe9e13cfbdc8aa055))

## [0.1.0](https://github.com/sincekmori/negirau/compare/v0.0.1...v0.1.0) (2026-08-21)


### Features

* launch Negirau, a one-tap login-free way to send appreciation to the people behind everyday work ([f13714d](https://github.com/sincekmori/negirau/commit/f13714db01fb2e07470059aa3c782c0a27fe4dae))


### Bug Fixes

* generate the worker types instead of checking a file that is never committed, start the manifest at 0.0.1 so release-please honours bump-minor-pre-major, drop the redundant version literal from the skill's spec-snapshot pointer, and re-sync the whole generated skill directory on release branches ([8be15a4](https://github.com/sincekmori/negirau/commit/8be15a48035f3a89a0b82c7c56cdc411aab4707b))
* give the checks job the dev vars its Env type needs and tell pnpm/action-setup which package.json declares the package manager ([58bf9a1](https://github.com/sincekmori/negirau/commit/58bf9a131aade8bc6d28302cb9bcff20a45e1730))
