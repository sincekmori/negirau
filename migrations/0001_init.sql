-- Negirau schema. Subjects are abstract recipients of appreciation: a name,
-- plus an optional location. No table holds data about the people who SEND
-- reactions; created_ip tracks only who CREATED a subject.

CREATE TABLE subjects (
  rowid INTEGER PRIMARY KEY,
  id TEXT NOT NULL UNIQUE CHECK (id <> 'new'),  -- public identifier: UUID by default, operator-set otherwise ('new' is taken by the create form's URL)
  name TEXT NOT NULL,
  lat REAL,
  lng REAL,                      -- spatial dimension (WGS84, optional)
  geohash TEXT,                  -- precision 5, derived from lat/lng
  status TEXT NOT NULL DEFAULT 'active',  -- 'active' | 'quarantined' | 'removed'
  listed INTEGER NOT NULL DEFAULT 1,      -- 0 = link-only: off every enumeration surface, reachable by URL; orthogonal to status
  created_at TEXT NOT NULL,      -- ISO 8601 in UTC (trailing Z); all stored times are UTC
  created_ip TEXT                -- legal traceability; NULL = operator-created
);
CREATE INDEX idx_subjects_geohash ON subjects (geohash) WHERE geohash IS NOT NULL;
-- 1-2 character queries: bounded prefix seeks over enumerable names (the
-- trigram FTS index below cannot match fewer than 3 characters).
CREATE INDEX idx_subjects_name ON subjects (name) WHERE status = 'active' AND listed = 1;
-- `ops purge` seeks the rows awaiting physical deletion instead of scanning
-- the table; the partial index holds only those few, so it costs nothing on
-- the write path and keeps every operator query bounded.
CREATE INDEX idx_subjects_removed ON subjects (rowid) WHERE status = 'removed';

-- Daily reaction counters. Every surface shows the all-time sum; the day
-- granularity exists for the surgical rollback of an attacked day.
-- One reaction = one UPSERT.
CREATE TABLE reaction_counts (
  -- CASCADE, not a hand-written multi-table delete: `ops purge` removes a
  -- subject for real, and SQLite reuses a freed rowid, so a counter left
  -- behind would resurface as some later subject's reactions.
  subject_rowid INTEGER NOT NULL REFERENCES subjects(rowid) ON DELETE CASCADE,
  type TEXT NOT NULL,
  day TEXT NOT NULL,             -- ISO date, UTC day boundary (see app/lib/dates.ts)
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (subject_rowid, type, day)
);
-- No day index on purpose: every read leads with subject_rowid (PK prefix),
-- and the operator's surgical day rollback (DELETE ... WHERE day = ?) is a
-- rare full scan — cheaper than maintaining an index on every reaction.
-- Anonymous update/delete requests. With no auth there is nothing to apply
-- them automatically against, so they queue here for the operator's daily
-- review (applied via SQL, then the row is deleted). One live row per
-- subject x kind -- a newer request overwrites the pending one -- keeps the
-- table bounded by the subject count (D1 free tier).
CREATE TABLE subject_requests (
  subject_rowid INTEGER NOT NULL REFERENCES subjects(rowid) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('update', 'delete')),
  payload TEXT,                  -- JSON of the requested fields (update only)
  created_at TEXT NOT NULL,      -- ISO 8601
  PRIMARY KEY (subject_rowid, kind)
);

-- Free-text name search: FTS5 trigram (substring matching that needs no word
-- segmentation, so Japanese works), external-content, trigger-synced.
CREATE VIRTUAL TABLE subjects_fts USING fts5(
  name,
  tokenize = 'trigram',
  content = 'subjects',
  content_rowid = 'rowid'
);

CREATE TRIGGER subjects_fts_insert AFTER INSERT ON subjects BEGIN
  INSERT INTO subjects_fts (rowid, name) VALUES (new.rowid, new.name);
END;

CREATE TRIGGER subjects_fts_delete AFTER DELETE ON subjects BEGIN
  INSERT INTO subjects_fts (subjects_fts, rowid, name) VALUES ('delete', old.rowid, old.name);
END;

CREATE TRIGGER subjects_fts_update AFTER UPDATE OF name ON subjects BEGIN
  INSERT INTO subjects_fts (subjects_fts, rowid, name) VALUES ('delete', old.rowid, old.name);
  INSERT INTO subjects_fts (rowid, name) VALUES (new.rowid, new.name);
END;
