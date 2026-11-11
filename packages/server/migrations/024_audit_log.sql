-- Append-only log of API-key writes (NOT-187, ADR-015). No secrets, no content:
-- who (key snapshot), what (operation id), on what (target id), when.
CREATE TABLE audit_log (
  id       TEXT PRIMARY KEY,
  at       TEXT NOT NULL,
  user_id  TEXT NOT NULL,
  key_id   TEXT NOT NULL,
  key_name TEXT NOT NULL,
  operation TEXT NOT NULL,
  target   TEXT
);
CREATE INDEX idx_audit_log_at ON audit_log(at);
CREATE INDEX idx_audit_log_key ON audit_log(key_id, at);
