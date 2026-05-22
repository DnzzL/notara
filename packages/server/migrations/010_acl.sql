CREATE TABLE IF NOT EXISTS acl_tuples (
  resource_type TEXT NOT NULL CHECK(resource_type IN ('page', 'block')),
  resource_id   TEXT NOT NULL,
  relation      TEXT NOT NULL CHECK(relation IN ('owner', 'editor', 'viewer')),
  subject       TEXT NOT NULL,
  PRIMARY KEY (resource_type, resource_id, relation, subject)
);
CREATE INDEX IF NOT EXISTS idx_acl_resource ON acl_tuples(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_acl_subject ON acl_tuples(subject);
