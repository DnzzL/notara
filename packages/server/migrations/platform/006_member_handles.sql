-- Member handles (NOT-151): what an @mention names, unique in the workspace
-- (index in 007, apart so a rerun that stops on "duplicate column" here cannot
-- skip it). Filled in code (member-handles.ts): on join, and for existing
-- members by the backfill that runs after these migrations.
ALTER TABLE workspace_members ADD COLUMN handle TEXT;
