-- Formula field expressions (e.g. `prop("Price") * prop("Qty")`).
-- Null for non-formula fields.
ALTER TABLE database_fields ADD COLUMN formula TEXT;

-- Column ordering inside a database (drag-to-reorder headers).
-- Default 0; reorderFields rewrites with 1-based indices.
ALTER TABLE database_fields ADD COLUMN sort_order REAL NOT NULL DEFAULT 0;
