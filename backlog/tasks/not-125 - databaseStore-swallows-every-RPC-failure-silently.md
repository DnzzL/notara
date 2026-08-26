---
id: NOT-125
title: databaseStore swallows every RPC failure silently
status: ready-for-agent
assignee: []
created_date: '2026-08-26 18:09'
labels:
  - bug
dependencies: []
priority: high
ordinal: 120000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
All 19 async actions in packages/app/src/stores/databaseStore.ts call the API with no error handling at all. Creating a database, renaming a field, deleting a record, saving a view — if the call fails, the promise rejects into nothing and the UI simply does not change. The user sees their action have no effect and is told nothing.

Every other store does this properly: blockStore and pageStore wrap each call in try/catch and call showError, rethrowing where the caller needs to know.

How it went unnoticed: scripts/check-effect-errors.sh guards exactly this, with the heuristic 'a store containing await api. must also contain a try'. databaseStore satisfied it by accident — the only try in the file belonged to parseViewConfig's JSON.parse, unrelated to any network call. Moving that function into lib/viewConfig.ts during NOT-115 removed the last try and turned the guard red, which is how the gap surfaced. The calls were never guarded; the check was green for the wrong reason.

Worth deciding per action rather than mechanically: a failed load can show an error and leave the previous state, while a failed write usually has to rethrow so the calling component can roll back its optimistic update. blockStore's createBlock is the reference for the rethrowing shape.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Every async action in databaseStore reports failure to the user rather than silently doing nothing
- [ ] #2 Actions whose callers perform optimistic updates rethrow, so the caller can roll back
- [ ] #3 scripts/check-effect-errors.sh passes for a reason rather than by accident
- [ ] #4 The guard heuristic is tightened, or its limitation noted, so a stray unrelated try cannot make a store look handled again
<!-- AC:END -->
