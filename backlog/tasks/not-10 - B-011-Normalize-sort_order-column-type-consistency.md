---
id: NOT-10
title: 'B-011: Normalize sort_order column type consistency'
status: ready for agent
assignee: []
created_date: '2026-06-12 13:55'
updated_date: '2026-06-12 14:05'
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
