---
id: NOT-9
title: 'B-008: Zustand stores swallow all errors silently'
status: needs human validation
assignee: []
created_date: '2026-06-12 13:55'
updated_date: '2026-06-12 14:05'
labels:
  - enhancement
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
Two possible UX patterns: (a) add an error field to each Zustand store and surface via a Toaster component, (b) use an error boundary at the app level. Which pattern fits the existing app architecture?
<!-- SECTION:NOTES:END -->
