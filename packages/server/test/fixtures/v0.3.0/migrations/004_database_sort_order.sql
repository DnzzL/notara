-- Add sort_order to databases for interleaving with blocks in drag-drop
ALTER TABLE databases ADD COLUMN sort_order REAL NOT NULL DEFAULT 0;
