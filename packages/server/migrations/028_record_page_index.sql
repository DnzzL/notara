-- Every page listed says which record it opens (NOT-166): looked up by page.
CREATE INDEX IF NOT EXISTS idx_database_records_page ON database_records(page_id);
