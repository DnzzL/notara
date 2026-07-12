CREATE TABLE IF NOT EXISTS page_shares (
  token TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  page_id TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_page_shares_page ON page_shares(page_id);
CREATE INDEX IF NOT EXISTS idx_page_shares_workspace ON page_shares(workspace_id);
