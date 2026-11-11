-- Trash model: when a page/database/record is soft-deleted (is_deleted = 1) we
-- also record WHEN, so a scheduled sweep can permanently purge items past the
-- retention window. NULL means "not in trash". Hard purge cascades to children
-- via the existing ON DELETE CASCADE foreign keys.
ALTER TABLE pages            ADD COLUMN deleted_at TEXT;
ALTER TABLE databases        ADD COLUMN deleted_at TEXT;
ALTER TABLE database_records ADD COLUMN deleted_at TEXT;

-- Backfill already-trashed rows so they enter the retention window from now,
-- rather than being purged instantly on the first sweep.
UPDATE pages            SET deleted_at = datetime('now') WHERE is_deleted = 1 AND deleted_at IS NULL;
UPDATE databases        SET deleted_at = datetime('now') WHERE is_deleted = 1 AND deleted_at IS NULL;
UPDATE database_records SET deleted_at = datetime('now') WHERE is_deleted = 1 AND deleted_at IS NULL;
