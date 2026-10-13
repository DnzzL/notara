-- Short record ids (NOT-148): `NOT-12` instead of an opaque ULID.
--
-- A database carries a prefix, unique in the workspace, and the next number to
-- hand out. A record keeps the number it was given forever: the counter only
-- grows, so a purged record's number is never handed to another one.
--
-- One transaction: applyMigrations records a file as applied when it fails on
-- "duplicate column", so a half-applied file would never get its backfill,
-- indexes or trigger on the next boot.
BEGIN;

ALTER TABLE databases ADD COLUMN short_prefix TEXT;
ALTER TABLE databases ADD COLUMN next_short_number INTEGER NOT NULL DEFAULT 1;
ALTER TABLE database_records ADD COLUMN short_number INTEGER;

-- Existing databases get their prefix from their name, close to what new ones
-- get (allocatePrefix): its first three leading letters, uppercased; DB when it has fewer
-- than two leading letters; a numeric suffix on a collision. Letters only, so a
-- base can never equal another base plus its suffix. Accented names fall back
-- to DB here, where the handler would strip the accent.
UPDATE databases SET short_prefix = t.base || CASE WHEN t.n > 1 THEN t.n ELSE '' END
FROM (
  SELECT id, base, row_number() OVER (PARTITION BY base ORDER BY rowid) AS n
  FROM (
    SELECT id, rowid, CASE
      WHEN name GLOB '[A-Za-z][A-Za-z][A-Za-z]*' THEN upper(substr(name, 1, 3))
      WHEN name GLOB '[A-Za-z][A-Za-z]*' THEN upper(substr(name, 1, 2))
      ELSE 'DB'
    END AS base
    FROM databases
  )
) AS t
WHERE t.id = databases.id;

-- Existing records are numbered per database, in creation order. created_at
-- holds both `YYYY-MM-DD HH:MM:SS` and ISO `…T…Z`; the replace makes them sort
-- together.
UPDATE database_records SET short_number = t.n
FROM (
  SELECT id, row_number() OVER (
    PARTITION BY database_id ORDER BY replace(created_at, 'T', ' '), id
  ) AS n
  FROM database_records
) AS t
WHERE t.id = database_records.id;

UPDATE databases SET next_short_number = 1 + COALESCE(
  (SELECT MAX(short_number) FROM database_records r WHERE r.database_id = databases.id), 0);

CREATE UNIQUE INDEX idx_databases_short_prefix ON databases(short_prefix);
CREATE UNIQUE INDEX idx_records_short_number ON database_records(database_id, short_number);

-- Every insert path (handlers, templates, Notion import) numbers its records
-- here rather than each remembering to.
CREATE TRIGGER trg_record_short_number
AFTER INSERT ON database_records
WHEN NEW.short_number IS NULL
BEGIN
  UPDATE database_records
    SET short_number = (SELECT next_short_number FROM databases WHERE id = NEW.database_id)
    WHERE id = NEW.id;
  UPDATE databases SET next_short_number = next_short_number + 1
    WHERE id = NEW.database_id;
END;

COMMIT;
