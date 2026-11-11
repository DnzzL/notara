-- An API key may be limited to one page subtree.
--
-- NULL means the whole of what the owner can reach, as every key did until now.
-- A page id is a ULID, unique across workspaces, so no workspace column: in any
-- other workspace the root is simply not an ancestor of anything.
ALTER TABLE api_keys ADD COLUMN root_page_id TEXT;
