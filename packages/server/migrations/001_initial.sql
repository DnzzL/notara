-- Pages tree
CREATE TABLE IF NOT EXISTS pages (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  parent_id TEXT REFERENCES pages(id) ON DELETE SET NULL,
  icon TEXT,
  cover_url TEXT,
  is_deleted INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Blocks (ordered content within a page)
CREATE TABLE IF NOT EXISTS blocks (
  id TEXT PRIMARY KEY,
  page_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  parent_id TEXT REFERENCES blocks(id) ON DELETE CASCADE,
  "index" INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_blocks_page ON blocks(page_id);
CREATE INDEX IF NOT EXISTS idx_blocks_parent ON blocks(parent_id);

-- Databases
CREATE TABLE IF NOT EXISTS databases (
  id TEXT PRIMARY KEY,
  page_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_deleted INTEGER NOT NULL DEFAULT 0
);

-- Database fields (columns)
CREATE TABLE IF NOT EXISTS database_fields (
  id TEXT PRIMARY KEY,
  database_id TEXT NOT NULL REFERENCES databases(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  options TEXT,
  relation_target_db_id TEXT REFERENCES databases(id)
);

-- Database records (rows)
CREATE TABLE IF NOT EXISTS database_records (
  id TEXT PRIMARY KEY,
  database_id TEXT NOT NULL REFERENCES databases(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  is_deleted INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Record field values
CREATE TABLE IF NOT EXISTS record_field_values (
  id TEXT PRIMARY KEY,
  record_id TEXT NOT NULL REFERENCES database_records(id) ON DELETE CASCADE,
  field_id TEXT NOT NULL REFERENCES database_fields(id) ON DELETE CASCADE,
  value TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_rfv_record ON record_field_values(record_id);
CREATE INDEX IF NOT EXISTS idx_rfv_field ON record_field_values(field_id);

-- Database views (table/board configurations)
CREATE TABLE IF NOT EXISTS database_views (
  id TEXT PRIMARY KEY,
  database_id TEXT NOT NULL REFERENCES databases(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'table',
  group_by_field_id TEXT REFERENCES database_fields(id),
  sort_field_id TEXT REFERENCES database_fields(id),
  sort_order TEXT NOT NULL DEFAULT 'asc'
);

-- Full-text search on pages
CREATE VIRTUAL TABLE IF NOT EXISTS pages_fts USING fts5(
  title, content,
  content='pages',
  content_rowid='rowid'
);

-- FTS triggers
CREATE TRIGGER IF NOT EXISTS pages_ai AFTER INSERT ON pages BEGIN
  INSERT INTO pages_fts(rowid, title, content) VALUES (new.rowid, new.title, '');
END;
CREATE TRIGGER IF NOT EXISTS pages_ad AFTER DELETE ON pages BEGIN
  INSERT INTO pages_fts(pages_fts, rowid, title, content) VALUES('delete', old.rowid, old.title, '');
END;
