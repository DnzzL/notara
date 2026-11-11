-- Free-form text description per database record. Flat text only (no nested
-- blocks): gives users a place for notes/longer context without opening a
-- nested page editor.
ALTER TABLE database_records ADD COLUMN description TEXT NOT NULL DEFAULT '';
