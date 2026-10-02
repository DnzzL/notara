---
id: NOT-142
title: 'Search: page-title queries return nothing, and ''-'' fails the query'
status: needs-triage
assignee: []
created_date: '2026-10-01 20:14'
labels: []
dependencies: []
priority: medium
ordinal: 137000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found while verifying the Effect 4.0.0 migration in a real browser; both defects are SQLite/schema level and pre-date that migration (raw SQL outside Effect reproduces them, migrations untouched).

1. pages-title search silently returns []. pages_fts is declared external-content over pages with columns (title, content), but pages has no content column (PRAGMA table_info). The index is populated (pages_fts_docsize = 1) yet MATCH yields nothing; SELECT count(*) FROM pages_fts errors with 'no such column: T.content'. Needs a migration that rebuilds pages_fts with columns matching the pages table.

2. FTS5 operator characters reach the query unescaped. escapeFtsQuery strips \"<>~() but not '-', so 'agent-browser' parses as a boolean expression and the statement fails with SQLiteError 'no such column: browser'. The RPC returns 200 with a Defect cause and the UI shows 'Search failed'.

Block-content search (blocks_fts) works: query 'second' returns the block hit.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Typing a word that appears in a page title in the ⌘K search returns that page
- [ ] #2 A query containing '-' (e.g. agent-browser) returns matches instead of the 'Search failed' toast
- [ ] #3 globalSearch handler tests cover title match, block match, and FTS operator characters
- [ ] #4 Deleted pages and blocks stay excluded (NOT-26 regression)
<!-- AC:END -->
