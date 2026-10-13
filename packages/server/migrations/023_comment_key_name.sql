-- The API key a comment was written through (NOT-150), so a reader can tell an
-- agent's comment from its owner's own. NULL: written in the app. A snapshot of
-- the key's name: renaming or revoking the key leaves past comments as written.
ALTER TABLE comments ADD COLUMN key_name TEXT;
