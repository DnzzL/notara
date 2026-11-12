-- pages_fts was declared with (title, content) over `pages`, which has no
-- content column: every MATCH returned nothing. Rebuild it on title alone and
-- add the missing UPDATE trigger so renames are indexed.
DROP TRIGGER IF EXISTS pages_ai;
DROP TRIGGER IF EXISTS pages_ad;
DROP TRIGGER IF EXISTS pages_au;
DROP TABLE IF EXISTS pages_fts;

CREATE VIRTUAL TABLE pages_fts USING fts5(
  title,
  content='pages',
  content_rowid='rowid'
);

CREATE TRIGGER pages_ai AFTER INSERT ON pages BEGIN
  INSERT INTO pages_fts(rowid, title) VALUES (new.rowid, new.title);
END;
CREATE TRIGGER pages_ad AFTER DELETE ON pages BEGIN
  INSERT INTO pages_fts(pages_fts, rowid, title) VALUES('delete', old.rowid, old.title);
END;
CREATE TRIGGER pages_au AFTER UPDATE OF title ON pages BEGIN
  INSERT INTO pages_fts(pages_fts, rowid, title) VALUES('delete', old.rowid, old.title);
  INSERT INTO pages_fts(rowid, title) VALUES (new.rowid, new.title);
END;

INSERT INTO pages_fts(pages_fts) VALUES('rebuild');
