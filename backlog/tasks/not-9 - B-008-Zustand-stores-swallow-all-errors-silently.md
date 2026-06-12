---
id: NOT-9
title: 'B-008: Zustand stores swallow all errors silently'
status: ready for agent
assignee: []
created_date: '2026-06-12 13:55'
updated_date: '2026-06-12 15:54'
labels:
  - enhancement
  - ready-for-agent
dependencies: []
references:
  - packages/app/src/stores/pageStore.ts
  - packages/app/src/stores/blockStore.ts
  - packages/app/src/stores/databaseStore.ts
priority: low
ordinal: 9000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Every async action in Zustand stores wraps errors in try/catch that only calls console.error. Users see nothing when a network request fails — stale data remains on screen.\n\nFiles: packages/app/src/stores/pageStore.ts, blockStore.ts, databaseStore.ts\n\nFix: Add error field to each store, surface via Toaster.tsx or error boundary.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Network error when loading pages shows a visible error to user
- [ ] #2 Successful retry clears the error
- [ ] #3 bun --bun tsc --noEmit -p packages/app passes (ignoring pre-existing)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Decision: Replace console.error with toaster.create in pageStore.ts. App already has Ark UI toaster (toaster.ts + Toaster.tsx) rendered in layout. Import toaster from '../toaster.js' and call toaster.create({ type:'error', title:'Failed to load pages', description: String(e) }) in each catch block.

Only pageStore.ts has try/catch with console.error — blockStore.ts and databaseStore.ts have no try/catch blocks. For blockStore and databaseStore, errors propagate as unhandled rejections (still invisible to user). Consider adding a global unhandled rejection handler that shows a toast as a follow-up.
<!-- SECTION:NOTES:END -->
