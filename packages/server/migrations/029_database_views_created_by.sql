-- A view's owner/source (ADR-014: "Views gain a nullable owner/source"), so a
-- later ticket where agents create their own working sets needs no backfill.
-- Nullable on purpose: the views that exist today were made in the app by a
-- person, and nothing reads this column yet. Not backfilled, not NOT NULL.
ALTER TABLE database_views ADD COLUMN created_by TEXT;
