-- Artifacts (NOT-162, ADR-013): an attachment shown live in its page, in an
-- isolated frame. Only files attached as artifacts are served as documents;
-- an HTML file uploaded before stays a download.
ALTER TABLE attachments ADD COLUMN artifact INTEGER NOT NULL DEFAULT 0;
