-- Add sort_order to database_records for card ordering in board view
ALTER TABLE database_records ADD COLUMN sort_order REAL NOT NULL DEFAULT 0;
