-- The inbox (NOT-152): one entry per member per comment that concerns them —
-- it mentions them, or sits on a record they are assigned to (a people field).
-- The FK pragma is off: deleting a comment, or purging its page, deletes these.
CREATE TABLE IF NOT EXISTS inbox_entries (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  comment_id TEXT NOT NULL REFERENCES comments(id),
  page_id TEXT NOT NULL REFERENCES pages(id),
  reason TEXT NOT NULL CHECK (reason IN ('mention', 'assigned')),
  created_at TEXT NOT NULL,
  read_at TEXT,
  UNIQUE (user_id, comment_id)
);
CREATE INDEX IF NOT EXISTS idx_inbox_user ON inbox_entries(user_id, read_at);
