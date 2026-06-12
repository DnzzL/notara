---
id: NOT-10
title: 'B-011: Normalize sort_order column type consistency'
status: done
assignee:
  - '@thomas'
created_date: '2026-06-12 13:55'
updated_date: '2026-06-12 14:16'
labels:
  - enhancement
dependencies:
  - NOT-4
references:
  - packages/server/migrations/003_page_sort_order.sql
priority: low
ordinal: 10000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
sort_order on pages was added as REAL in migration 003, while the TypeScript code treats them as number throughout. All sort_order columns should use the same type.\n\nFiles: migrations/003_page_sort_order.sql, migrations/001_initial.sql\n\nFix: Normalize all sort_order columns to INTEGER in a migration, since the code only ever assigns whole numbers.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 All sort_order columns use INTEGER type
- [x] #2 bun --bun tsc --noEmit -p packages/server passes
- [x] #3 bun test packages/server/test passes
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Check current sort_order types across all tables\n2. Create migration to normalize all to INTEGER\n3. Verify with tsc and tests
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Created migration 016 to normalize all sort_order columns from REAL to INTEGER. Updated in-memory test schema definitions.
<!-- SECTION:NOTES:END -->
