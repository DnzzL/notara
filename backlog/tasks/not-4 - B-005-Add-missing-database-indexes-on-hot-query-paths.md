---
id: NOT-4
title: 'B-005: Add missing database indexes on hot query paths'
status: done
assignee:
  - '@thomas'
created_date: '2026-06-12 13:55'
updated_date: '2026-06-12 14:14'
labels:
  - enhancement
dependencies: []
references:
  - packages/server/migrations/001_initial.sql
priority: medium
ordinal: 4000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Several heavily-queried columns lack indexes:\n- pages.parent_id (used in getDescendants, createPage, movePage)\n- pages.is_deleted (used in all page listing queries)\n- pages.deleted_at (trash sweep, listTrash)\n- databases.page_id (listDatabases, purgePage)\n- database_records.database_id (all record listing queries)\n\nFile: packages/server/migrations/001_initial.sql\n\nFix: Create migration 015 with CREATE INDEX IF NOT EXISTS for each.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 New migration creates all 5 indexes
- [x] #2 Existing data is unchanged
- [x] #3 bun --bun tsc --noEmit -p packages/server passes
- [x] #4 bun test packages/server/test passes
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Create migration 015 with CREATE INDEX IF NOT EXISTS for pages.parent_id, pages.is_deleted, pages.deleted_at, databases.page_id, database_records.database_id\n2. Verify tsc and tests pass
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Created migration 015 with indexes on pages.parent_id, pages.is_deleted, pages.deleted_at, databases.page_id, database_records.database_id
<!-- SECTION:NOTES:END -->
