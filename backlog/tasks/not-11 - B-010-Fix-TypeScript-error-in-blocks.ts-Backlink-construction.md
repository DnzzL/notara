---
id: NOT-11
title: 'B-010: Fix TypeScript error in blocks.ts Backlink construction'
status: done
assignee:
  - '@thomas'
created_date: '2026-06-12 13:55'
updated_date: '2026-06-12 14:13'
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

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Rebuild shared package to include blockType in Backlink schema dist\n2. Verify tsc passes
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
The row type annotation in blocks.ts already included blockType. The issue was a stale @notara/shared dist artifact. Running 'bun run build' rebuilds the shared package and resolves the TS error. Verified full build passes.
<!-- SECTION:NOTES:END -->
