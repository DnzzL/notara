-- Per-database title column customization: label override and hide flag.
-- Lets users rename "Name" or hide the title column entirely when their
-- workflow is structured around custom properties (e.g. a page-link field
-- as the primary identifier).
ALTER TABLE databases ADD COLUMN title_label TEXT NOT NULL DEFAULT 'Name';
ALTER TABLE databases ADD COLUMN title_hidden INTEGER NOT NULL DEFAULT 0;
