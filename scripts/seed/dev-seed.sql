-- The seed dataset: operator-created rows with chosen ids, plus three
-- location-bearing rows under fixed UUIDs. Every row is operator-created
-- (created_ip NULL) and shares one created_at, so listing order is the
-- insertion order below, newest last.
--
-- The geohash column is precomputed here rather than derived at insert time:
-- near-search prefix-seeks it, so it must equal encodeGeohash(lat, lng) at
-- precision 5 (app/lib/geohash.ts) — recompute it when a coordinate changes.
INSERT OR IGNORE INTO subjects (id, name, lat, lng, geohash, created_at) VALUES
  ('sincekmori', 'Shinsuke Mori', NULL, NULL, NULL, '2026-08-01T00:00:00Z'),
  ('youtube', 'YouTube', NULL, NULL, NULL, '2026-08-01T00:00:00Z'),
  ('claude', 'Claude', NULL, NULL, NULL, '2026-08-01T00:00:00Z'),
  ('chatgpt', 'ChatGPT', NULL, NULL, NULL, '2026-08-01T00:00:00Z'),
  ('d987e945-2d23-4e33-a725-76fc11a7c0c2', '東京駅', 35.68115, 139.76448, 'xn76u', '2026-08-01T00:00:00Z'),
  ('f2924db9-1225-48f2-94a2-bc2856774d8a', '羽田空港', 35.54768, 139.76847, 'xn76h', '2026-08-01T00:00:00Z'),
  ('7a1c5d9e-2f3b-4c4d-8e5f-6a7b8c9d0e1f', '世田谷区たまがわ花火大会', 35.61393, 139.61548, 'xn769', '2026-08-01T00:00:00Z');
