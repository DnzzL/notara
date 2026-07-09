-- Full-text search on block content
CREATE VIRTUAL TABLE IF NOT EXISTS blocks_fts USING fts5(
  content,
  content='blocks',
  content_rowid='rowid'
);

-- Trigger: insert new block content into FTS
CREATE TRIGGER IF NOT EXISTS blocks_ai AFTER INSERT ON blocks BEGIN
  INSERT INTO blocks_fts(rowid, content) VALUES (new.rowid, new.content);
END;

-- Trigger: remove deleted block content from FTS
CREATE TRIGGER IF NOT EXISTS blocks_ad AFTER DELETE ON blocks BEGIN
  INSERT INTO blocks_fts(blocks_fts, rowid, content) VALUES('delete', old.rowid, old.content);
END;

-- Trigger: update block content in FTS (delete old + insert new)
CREATE TRIGGER IF NOT EXISTS blocks_au AFTER UPDATE ON blocks BEGIN
  INSERT INTO blocks_fts(blocks_fts, rowid, content) VALUES('delete', old.rowid, old.content);
  INSERT INTO blocks_fts(rowid, content) VALUES (new.rowid, new.content);
END;
