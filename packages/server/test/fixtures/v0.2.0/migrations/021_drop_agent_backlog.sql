-- Removes what the retired agent-backlog builds (migrations 021_short_ids to
-- 029) left in a workspace DB. A no-op on a DB that never ran them. Leftover
-- nullable/defaulted columns (short_prefix, short_number, key_name, artifact,
-- created_by) stay: SQLite cannot DROP COLUMN IF EXISTS, and nothing reads them.
DROP TRIGGER IF EXISTS trg_record_short_number;
DROP INDEX IF EXISTS idx_records_short_number;
DROP INDEX IF EXISTS idx_databases_short_prefix;
DROP TABLE IF EXISTS inbox_entries;
DROP TABLE IF EXISTS comment_mentions;
DROP TABLE IF EXISTS comments;
