-- A page published as a read-only public link.
--
-- Sharing is a CAPABILITY, not a relation. The ACL (docs/adr/007) answers
-- "which relation does this user hold on this page"; a public visitor is not a
-- user and holds nothing. Modelling the link as an acl_tuple with a `public`
-- subject would put a row that grants access to *everyone* into the same table
-- the nearest-ancestor override walks, where a grant on a child silently
-- privatises a subtree. A token in its own table cannot be confused with a
-- relation, and revoking it is a DELETE rather than a rule.
--
-- The token lives in the platform DB rather than the workspace DB because it
-- is resolved BEFORE any workspace is known — the visitor arrives with nothing
-- but the token, and it has to name the workspace whose layer to open.
--
-- shared_by records who published it. A capability delegated by a person does
-- not outlive that person's own access: serving the token re-checks that they
-- can still read the page, so locking a page cuts every link published from it
-- without anyone having to remember the links exist.
CREATE TABLE page_shares (
  token TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  page_id TEXT NOT NULL,
  shared_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  -- At most one live token per page: re-enabling returns the existing one
  -- rather than minting a second, so revoking is unambiguous.
  UNIQUE (workspace_id, page_id)
);

CREATE INDEX idx_page_shares_page ON page_shares (workspace_id, page_id);
