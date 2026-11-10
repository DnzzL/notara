-- Add is_default flag to database_views so users can mark one saved view
-- as the default that loads automatically on page visit.
-- Only one view per database can be is_default = 1.
ALTER TABLE database_views ADD COLUMN is_default INTEGER NOT NULL DEFAULT 0;
