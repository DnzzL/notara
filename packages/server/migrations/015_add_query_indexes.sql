-- Add missing indexes on hot query paths

CREATE INDEX IF NOT EXISTS idx_pages_parent_id ON pages(parent_id);
CREATE INDEX IF NOT EXISTS idx_pages_is_deleted ON pages(is_deleted);
CREATE INDEX IF NOT EXISTS idx_pages_deleted_at ON pages(deleted_at);
CREATE INDEX IF NOT EXISTS idx_databases_page_id ON databases(page_id);
CREATE INDEX IF NOT EXISTS idx_database_records_database_id ON database_records(database_id);
