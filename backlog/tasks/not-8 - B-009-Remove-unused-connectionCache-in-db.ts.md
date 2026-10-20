---
id: NOT-8
title: 'B-009: Remove unused connectionCache in db.ts'
status: done
assignee:
  - '@thomas'
created_date: '2026-06-12 13:55'
updated_date: '2026-06-12 14:12'
labels:
  - enhancement
dependencies: []
references:
  - 'packages/server/src/db.ts:26'
priority: low
ordinal: 8000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
const connectionCache = new Map<...>() is declared at packages/server/src/db.ts:26 but never referenced. The actual workspace DB cache uses workspaceLayerCache.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 connectionCache variable is removed
- [x] #2 bun --bun tsc --noEmit -p packages/server passes
- [x] #3 bun test packages/server/test passes
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Remove unused connectionCache variable from db.ts\n2. Verify tsc and tests pass
<!-- SECTION:PLAN:END -->
