-- Who made the last edit (NOT-174, ADR-014). Additive: NULL means "unknown"
-- (rows written before this migration, or by a path that does not record).
--   updated_by           user id: the human, or the owner of the API key
--   updated_by_key_id    API key id; NULL for a UI edit
--   updated_by_key_name  the key's name AT THE TIME of the edit, so renaming or
--                        revoking the key later leaves the record readable
ALTER TABLE pages ADD COLUMN updated_by TEXT;
ALTER TABLE pages ADD COLUMN updated_by_key_id TEXT;
ALTER TABLE pages ADD COLUMN updated_by_key_name TEXT;
ALTER TABLE blocks ADD COLUMN updated_by TEXT;
ALTER TABLE blocks ADD COLUMN updated_by_key_id TEXT;
ALTER TABLE blocks ADD COLUMN updated_by_key_name TEXT;
