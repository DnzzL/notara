-- Which page took this one to the trash.
--
-- Deleting a page used to mark that row and nothing else, while the sidebar
-- builds its tree from parent_id — so the descendants disappeared from the UI
-- without ever being in the trash. They could not be restored on their own, and
-- once the retention sweep purged the parent row they were left pointing at a
-- parent that no longer existed: invisible for good, blocks intact, reachable
-- only through search. (The FK pragma is off in this codebase, so the
-- ON DELETE SET NULL on pages.parent_id never fires to clean that up.)
--
-- NULL means "deleted in its own right" — that is what the trash lists, and
-- what restore treats as an independent decision. Anything else is the id of
-- the page whose deletion swept it up, which is how restore knows what to bring
-- back and what to leave behind: a page trashed deliberately BEFORE its parent
-- was keeps its NULL, and stays in the trash when the parent comes back.
ALTER TABLE pages ADD COLUMN trashed_with TEXT;

-- "What came down with this page", for restore and for the retention sweep.
CREATE INDEX IF NOT EXISTS idx_pages_trashed_with ON pages(trashed_with);
