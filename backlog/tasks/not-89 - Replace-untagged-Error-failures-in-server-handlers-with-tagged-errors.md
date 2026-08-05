---
id: NOT-89
title: Replace untagged Error failures in server handlers with tagged errors
status: needs-triage
assignee: []
created_date: '2026-08-05 19:59'
updated_date: '2026-08-05 20:04'
labels:
  - enhancement
dependencies: []
priority: low
ordinal: 84000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The Effect language service (@effect/tsgo) flags 28 sites where handlers do Effect.fail(new Error(...)) or Effect.try with a catch returning a global Error (globalErrorInEffectFailure / globalErrorInEffectCatch). Untagged errors merge in the error channel, so the HTTP edge in packages/server/src/index.ts can only string-match or instanceof-check them (as it already does for AuthError). Both rules are currently set to off in tsconfig.base.json; flipping them back on is the acceptance signal.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A small tagged-error taxonomy (e.g. NotFound / Validation / Conflict) exists and every Effect.fail(new Error(...)) in packages/server/src/handlers, export/page.ts and index.ts uses it
- [ ] #2 The HTTP edge maps each tagged error to its status code instead of falling through to a generic 500
- [ ] #3 globalErrorInEffectFailure and globalErrorInEffectCatch are removed from diagnosticSeverity in tsconfig.base.json and bunx effect-tsgo diagnostics --project packages/server/tsconfig.json reports 0 errors and 0 warnings
<!-- AC:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: @claude
created: 2026-08-05 20:04
---
Sizing (from the tsgo install pass): 29 sites, 3 buckets — 16x "X not found", 7x conflict/validation, 5x REST JSON-parse in index.ts, 1x rewrap (workspaces.ts:43). Key constraint: rpc-handlers.ts pipes all 69 handlers through Effect.orDie, so today every failure crosses the RPC boundary as an opaque defect ({}), and the app toasts String(e). BlockLockedError is the existing precedent for a tagged class with an own message field that survives. So a pure swap to tagged errors silences the two rules but changes nothing user-visible; the valuable version also declares error: schemas on the ~24 affected Rpc.make entries, drops orDie there, and lets the client discriminate on _tag (BlockEditor.tsx:1001 currently string-matches "BlockLocked"). Server tests assert no error messages, so regression risk is low.
---
<!-- COMMENTS:END -->
