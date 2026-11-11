ALTER TABLE database_records ADD COLUMN page_id TEXT REFERENCES pages(id);
