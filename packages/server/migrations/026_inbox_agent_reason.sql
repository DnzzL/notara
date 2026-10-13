-- A comment written through an API key reaches the key's owner: it is their
-- agent speaking. A third inbox reason, 'agent'; SQLite cannot alter a CHECK,
-- so the table is rebuilt. One transaction, like 021.
BEGIN;

CREATE TABLE inbox_entries_new (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  comment_id TEXT NOT NULL REFERENCES comments(id),
  page_id TEXT NOT NULL REFERENCES pages(id),
  reason TEXT NOT NULL CHECK (reason IN ('mention', 'assigned', 'agent')),
  created_at TEXT NOT NULL,
  read_at TEXT,
  UNIQUE (user_id, comment_id)
);
INSERT INTO inbox_entries_new SELECT id, user_id, comment_id, page_id, reason, created_at, read_at FROM inbox_entries;
DROP TABLE inbox_entries;
ALTER TABLE inbox_entries_new RENAME TO inbox_entries;
CREATE INDEX idx_inbox_user ON inbox_entries(user_id, read_at);

COMMIT;
