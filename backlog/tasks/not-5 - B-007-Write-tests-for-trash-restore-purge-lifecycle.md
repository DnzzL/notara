---
id: NOT-5
title: 'B-007: Write tests for trash/restore/purge lifecycle'
status: done
assignee:
  - '@thomas'
created_date: '2026-06-12 13:55'
updated_date: '2026-06-12 14:17'
labels:
  - enhancement
dependencies: []
references:
  - packages/server/src/handlers/databases.ts
  - packages/server/migrations/013_deleted_at.sql
priority: medium
ordinal: 5000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The soft-delete -> restore -> permanent-purge lifecycle is entirely untested. These paths include explicit child-deletion loops (FK pragma is OFF), recursive purge across page/database/record boundaries, and the purgeExpired retention sweep. A bug means permanent data loss.\n\nFile: packages/server/src/handlers/databases.ts (lines 451+)\n\nCover: soft-delete page -> disappears from listPages -> listTrash shows it -> restore brings it back. Purge page -> verify blocks, databases, records, field values, views all deleted. purgeExpired with mocked deleted_at. Edge case: purge a record that has a backing page.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 At least 8 tests covering trash lifecycle scenarios
- [x] #2 Tests use existing TestDbLayer pattern
- [x] #3 bun test packages/server/test passes with new tests
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Examine existing test patterns in handlers.test.ts\n2. Write tests covering trash lifecycle: soft-delete page, listTrash, restore, permanent purge, purgeExpired, purge record with backing page\n3. Verify tests pass
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Added 10 tests covering trash lifecycle: soft-delete page/listTrash/restore, purge page/database/record, purgeExpired with retention, record with backing page, non-trashed items not in trash
<!-- SECTION:NOTES:END -->
