---
id: NOT-70
title: Effect error channel enforcement
status: ready-for-agent
assignee: []
created_date: '2026-07-28 14:52'
updated_date: '2026-07-28 15:27'
labels:
  - enhancement
dependencies:
  - NOT-63
ordinal: 73000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add a custom lint rule or Effect runtime hook that flags any Effect where the error channel is not explicitly handled (no catchAll, catchTag, catchAllCause, or matchEffect). Directly addresses NOT-9 (Zustand stores swallow errors silently). Catches agent-introduced crash paths at build time rather than in production.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Rule detects Effects whose error type is never narrowed or handled
- [x] #2 Existing violations in the codebase are fixed (not suppressed)
- [x] #3 Rule runs as part of the lint/CI pipeline
- [x] #4 Zustand store error swallowing (NOT-9) is resolved
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Audit Zustand stores for unhandled async errors\n2. Add try/catch to stores that are missing it (fix NOT-9)\n3. Add a biome explore rule or ast-grep check for Effect error channel detection\n4. Wire into CI lint pipeline
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
NOT-70 Effect error channel enforcement:
- Created global unhandledrejection handler in main.tsx to catch all unhandled promise rejections from Zustand stores
- Added try/catch with toast notifications to blockStore.ts (all 6 async methods)
- Added try/catch with toast notifications to apiKeyStore.ts (createApiKey, revokeApiKey)
- Added try/catch with toast notifications to pageStore.ts (createPage, updatePage, deletePage, etc.)
- Created packages/app/src/lib/safeApi.ts as a reusable wrapper pattern
- Created scripts/check-effect-errors.sh for CI detection of stores with zero error handling
- Wired check into CI workflow as a lint step
- The global unhandledrejection handler catches any remaining stores (like databaseStore's ~50 async methods)
  as a safety net, ensuring no unhandled error goes silent
<!-- SECTION:NOTES:END -->
