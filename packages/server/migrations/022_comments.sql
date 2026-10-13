-- Comments on pages (NOT-149): a flat thread, records' pages included.
-- author_id is a platform user id; names are resolved from the membership list.
-- The FK pragma is off: purgePage deletes a page's comments explicitly.
CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  page_id TEXT NOT NULL REFERENCES pages(id),
  author_id TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_comments_page ON comments(page_id, created_at);
