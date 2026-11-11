-- Normalize all sort_order columns from REAL to INTEGER
-- The TypeScript code only ever assigns whole numbers, so INTEGER is the
-- correct type. SQLite 3.51.0 supports DROP COLUMN which is safe here since
-- sort_order has no FK, PK, UNIQUE, or trigger dependencies.

ALTER TABLE pages ADD COLUMN sort_order_int INTEGER NOT NULL DEFAULT 0;
UPDATE pages SET sort_order_int = CAST(sort_order AS INTEGER);
ALTER TABLE pages DROP COLUMN sort_order;
ALTER TABLE pages RENAME COLUMN sort_order_int TO sort_order;

ALTER TABLE databases ADD COLUMN sort_order_int INTEGER NOT NULL DEFAULT 0;
UPDATE databases SET sort_order_int = CAST(sort_order AS INTEGER);
ALTER TABLE databases DROP COLUMN sort_order;
ALTER TABLE databases RENAME COLUMN sort_order_int TO sort_order;

ALTER TABLE database_records ADD COLUMN sort_order_int INTEGER NOT NULL DEFAULT 0;
UPDATE database_records SET sort_order_int = CAST(sort_order AS INTEGER);
ALTER TABLE database_records DROP COLUMN sort_order;
ALTER TABLE database_records RENAME COLUMN sort_order_int TO sort_order;

ALTER TABLE database_fields ADD COLUMN sort_order_int INTEGER NOT NULL DEFAULT 0;
UPDATE database_fields SET sort_order_int = CAST(sort_order AS INTEGER);
ALTER TABLE database_fields DROP COLUMN sort_order;
ALTER TABLE database_fields RENAME COLUMN sort_order_int TO sort_order;
