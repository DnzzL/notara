-- Favorites/starred pages
ALTER TABLE pages ADD COLUMN is_favorite INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_pages_favorite ON pages(is_favorite) WHERE is_favorite = 1;
