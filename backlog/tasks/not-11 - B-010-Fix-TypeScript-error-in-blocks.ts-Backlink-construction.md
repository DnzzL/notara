---
id: NOT-11
title: 'B-010: Fix TypeScript error in blocks.ts Backlink construction'
status: ready for agent
assignee: []
created_date: '2026-06-12 13:55'
updated_date: '2026-06-12 14:05'
labels:
  - bug
dependencies: []
references:
  - 'packages/server/src/handlers/blocks.ts:101'
priority: low
ordinal: 11000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
error TS2353: Object literal may only specify known properties, and 'blockType' does not exist in type '{ readonly pageId: string; readonly content: string; readonly blockId: string; readonly pageTitle: string; }'.\n\nThe Backlink schema class has blockType, but the SQL query result type annotation doesn't include it.\n\nFile: packages/server/src/handlers/blocks.ts:101
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 bun --bun tsc --noEmit -p packages/server passes with no errors
- [x] #2 Backlink instances still contain blockType at runtime
<!-- AC:END -->
