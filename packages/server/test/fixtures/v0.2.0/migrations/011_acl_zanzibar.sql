-- Rework acl_tuples so that each (resource, subject) has at most ONE relation.
-- Previously the PK included `relation`, which let a single subject hold both
-- (viewer) and (editor) on the same page — confusing on read and racy on
-- partial-delete writes. We also add:
--   * resource-scoped monotonic revision (for optimistic concurrency / zookies)
--   * a CHECK on `subject` that enforces the canonical wire format
--     (`user:<id>` / `workspace:<id>#member` / `public`).
--
-- This migration is idempotent: it rebuilds the table from existing rows,
-- collapsing duplicate subjects to their max-rank relation (owner > editor > viewer).

CREATE TABLE IF NOT EXISTS acl_tuples_new (
  resource_type TEXT NOT NULL CHECK(resource_type IN ('page', 'block')),
  resource_id   TEXT NOT NULL,
  subject       TEXT NOT NULL CHECK(
    subject = 'public'
    OR subject LIKE 'user:%'
    OR subject LIKE 'workspace:%#member'
  ),
  relation      TEXT NOT NULL CHECK(relation IN ('owner', 'editor', 'viewer')),
  PRIMARY KEY (resource_type, resource_id, subject)
);

-- Collapse duplicates: pick highest-rank relation per (resource, subject).
-- Filter out subjects that don't match the canonical format so the CHECK on
-- the new table doesn't reject the copy. The old schema let any string in;
-- malformed rows were unreachable anyway (the resolver never matched them).
INSERT OR REPLACE INTO acl_tuples_new (resource_type, resource_id, subject, relation)
SELECT
  resource_type,
  resource_id,
  subject,
  CASE
    WHEN MAX(CASE relation WHEN 'owner' THEN 3 WHEN 'editor' THEN 2 ELSE 1 END) = 3 THEN 'owner'
    WHEN MAX(CASE relation WHEN 'owner' THEN 3 WHEN 'editor' THEN 2 ELSE 1 END) = 2 THEN 'editor'
    ELSE 'viewer'
  END AS relation
FROM acl_tuples
WHERE subject = 'public'
   OR subject LIKE 'user:%'
   OR subject LIKE 'workspace:%#member'
GROUP BY resource_type, resource_id, subject;

DROP TABLE acl_tuples;
ALTER TABLE acl_tuples_new RENAME TO acl_tuples;

CREATE INDEX IF NOT EXISTS idx_acl_resource ON acl_tuples(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_acl_subject ON acl_tuples(subject);

-- Per-resource monotonic revision. Bumped on every ACL write; clients pass it
-- back via `ifRevision` for optimistic concurrency, and reads carry it so the
-- UI can tell when its view is stale.
CREATE TABLE IF NOT EXISTS acl_revisions (
  resource_type TEXT NOT NULL,
  resource_id   TEXT NOT NULL,
  revision      INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (resource_type, resource_id)
);

-- Seed revision=1 for every resource that already has tuples so callers get a
-- meaningful token from day one.
INSERT OR IGNORE INTO acl_revisions (resource_type, resource_id, revision)
SELECT DISTINCT resource_type, resource_id, 1 FROM acl_tuples;
