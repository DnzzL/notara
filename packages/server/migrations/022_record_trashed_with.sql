-- Which master record's trashing swept this satellite row into the trash too
-- (opt-in sync, migration 021). Mirrors pages.trashed_with (migration 020):
-- NULL means "deleted in its own right" — that is what the trash lists, and
-- what restore treats as an independent decision. Otherwise it is the id of
-- the master record whose deletion cascaded here, so restore knows what to
-- bring back and a satellite row trashed deliberately BEFORE its master was
-- stays in the trash when the master comes back.
ALTER TABLE database_records ADD COLUMN trashed_with TEXT;

CREATE INDEX IF NOT EXISTS idx_database_records_trashed_with ON database_records(trashed_with);
