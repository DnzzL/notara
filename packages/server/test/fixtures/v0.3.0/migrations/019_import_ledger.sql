-- Identity for imported things, so a second import updates instead of cloning.
--
-- Until now the importer held three in-memory maps for the duration of one run
-- and minted a fresh ULID for every row it wrote. Nothing was persisted, so
-- re-running the same Notion export was a clone by definition rather than by
-- accident — one workspace ended up with thirteen copies of every database.
--
-- `source_key` is whatever identifies the thing *in the export*, and differs by
-- kind because Notion gives us different handles:
--   page     — the GUID Notion appends to the file name
--   database — the CSV's path within the export
--   field    — <databaseId>::<column header>
--   record   — <databaseId>::<row title>
--
-- Fields and records are keyed by name rather than by a Notion id because the
-- CSV export carries no per-column or per-row identifier. Renaming a column in
-- Notion therefore reads as a new column on re-import; that is a limitation of
-- the export format, not a choice, and it is better than the alternative of
-- duplicating everything every time.
--
-- `last_run_id` is what lets a run act only on its own artifacts, so placeholder
-- resolution and the empty-page prune stop operating workspace-wide.
CREATE TABLE IF NOT EXISTS import_ledger (
  source      TEXT NOT NULL,
  kind        TEXT NOT NULL CHECK(kind IN ('page', 'database', 'field', 'record')),
  source_key  TEXT NOT NULL,
  local_id    TEXT NOT NULL,
  last_run_id TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (source, kind, source_key)
);

-- "Everything this run touched", the query run scoping depends on.
CREATE INDEX IF NOT EXISTS idx_import_ledger_run ON import_ledger(last_run_id);

-- "What was this local row imported as", for diagnosing a bad import.
CREATE INDEX IF NOT EXISTS idx_import_ledger_local ON import_ledger(local_id);
