---
id: NOT-125
title: databaseStore swallows every RPC failure silently
status: done
assignee: []
created_date: '2026-08-26 18:09'
updated_date: '2026-08-26 18:21'
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
- [x] #1 Every async action in databaseStore reports failure to the user rather than silently doing nothing
- [x] #2 Actions whose callers perform optimistic updates rethrow, so the caller can roll back
- [x] #3 scripts/check-effect-errors.sh passes for a reason rather than by accident
- [x] #4 The guard heuristic is tightened, or its limitation noted, so a stray unrelated try cannot make a store look handled again
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Bigger than the ticket described, in two ways.

Scope: historyStore had the same gap. Its undo path recreates a deleted block and refreshes the list; both calls were bare, so a failed undo left the block gone, the undo entry popped, and nothing said. Both now rethrow deliberately — applyInverse pops the stack only when the inverse succeeded.

Shape: rather than nineteen copies of try/catch, lib/storeErrors.ts states the policy once. guarded() reports and rethrows, for calls whose caller must roll back an optimistic update; reported() reports and carries on, for loads, where rethrowing would reject into a caller with no way to react. Choosing between them is a real decision per call, and naming it makes it reviewable. This also stopped a third copy of showError from being added — blockStore and apiKeyStore still carry their own, noted rather than migrated.

AC 4 turned out to matter more than expected. The old heuristic was wrong in BOTH directions: it passed on an unrelated try, and then failed on databaseStore once the handling was correctly factored into a module. It now counts per call, and a try elsewhere in the file cannot vouch for an unrelated one.

Tightening it immediately reported pageStore with 14 unhandled calls. That was MY bug, not pageStore\s: BSD awk does not support \b, so my first pattern silently matched nothing on macOS while it would have matched in CI. A guard that disagrees with itself by platform is worse than no guard — I would have pushed a check that was green locally and red in CI, or the reverse. Patterns are portable now, and pageStore was correct all along.

store.test.ts asserted true. It now pins the policy including the case that must stay silent: an access denial is rendered by the component layer, which knows what the user was reaching for.

One unrelated fix pulled in by necessity: toaster.ts needed an explicit type annotation. Inferring it names a type inside .bun/, which is invisible under the app tsconfig and an error under the test project — and my new test imports it, so the test project started type-checking it.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Stop stores swallowing RPC failures, and fix the guard that missed it.

Nineteen actions in databaseStore called the API bare: a failed rename changed nothing on screen and said nothing, indistinguishable from a rename nobody attempted. historyStore had the same gap in its undo path — a failed undo of a delete left the block gone with no way back.

lib/storeErrors.ts states the policy once rather than nineteen times. guarded() reports and rethrows, for calls whose caller must roll back an optimistic update; reported() reports and carries on, for loads. It also stopped a third copy of showError being added to this package.

The guard was broken in both directions. It asked only whether a store file contained "try" anywhere — so databaseStore passed for years on a try belonging to a JSON.parse while every call was bare, then failed once that handling was correctly factored out. It counts per call now.

Tightening it reported pageStore with 14 unhandled calls, which was my own bug: BSD awk has no \b support, so the pattern silently matched nothing on macOS while it would have matched in CI. A guard that disagrees with itself by platform is worse than none. pageStore was correct all along.

store.test.ts asserted true; it now pins the policy, including the case that must stay silent.

Verified: quickcheck, check-effect-errors and biome ci all exit 0, 14 multiuser E2E pass. The chromium E2E projects fail on auth.setup.ts — confirmed identical with these changes stashed, so it is local .data state, not a regression.
<!-- SECTION:FINAL_SUMMARY:END -->
