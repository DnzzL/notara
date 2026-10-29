---
id: NOT-26
title: Search should exclude deleted pages and blocks
status: done
assignee:
  - '@thomas'
created_date: '2026-06-17 09:51'
updated_date: '2026-06-17 09:59'
labels:
  - search
  - ux
  - bug
dependencies: []
references:
  - packages/server/src/handlers/search.ts
  - packages/app/src/components/SearchModal.tsx
priority: medium
ordinal: 31000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Cmd+K (global search) currently returns deleted pages and blocks, only marking them with a "(deleted)" badge in the UI. Instead, the FTS queries should filter out deleted content entirely so users never see trash in search results.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The globalSearch handler in packages/server/src/handlers/search.ts filters out is_deleted pages and blocks in the SQL query
- [x] #2 Block search (blocks_fts join) also excludes rows belonging to deleted pages
- [x] #3 Frontend SearchModal no longer needs to render the isDeleted badge
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. In packages/server/src/handlers/search.ts: Add WHERE p.is_deleted = FALSE to pages FTS query and add AND p.is_deleted = FALSE to blocks FTS query to filter out deleted content\n2. Remove isDeleted from SELECT and SearchResult constructor since it's no longer needed\n3. In packages/app/src/components/SearchModal.tsx: Remove the isDeleted badge rendering for both page and block results
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- Modified globalSearch in search.ts: added AND p.is_deleted = 0 to both pages_fts and blocks_fts queries

- Removed isDeleted from SQL SELECT and SearchResult constructor calls

- Removed (deleted) badge rendering from SearchModal.tsx page and block result sections
<!-- SECTION:NOTES:END -->
