-- Add sort_order to pages for sibling page ordering in sidebar drag-drop
ALTER TABLE pages ADD COLUMN sort_order REAL NOT NULL DEFAULT 0;
