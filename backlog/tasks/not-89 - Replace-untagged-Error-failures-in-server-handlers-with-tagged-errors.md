---
id: NOT-89
title: Replace untagged Error failures in server handlers with tagged errors
status: done
assignee:
  - '@claude'
created_date: '2026-08-05 19:59'
updated_date: '2026-08-05 20:54'
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
- [x] #1 A small tagged-error taxonomy (e.g. NotFound / Validation / Conflict) exists and every Effect.fail(new Error(...)) in packages/server/src/handlers, export/page.ts and index.ts uses it
- [x] #2 The HTTP edge maps each tagged error to its status code instead of falling through to a generic 500
- [x] #3 globalErrorInEffectFailure and globalErrorInEffectCatch are removed from diagnosticSeverity in tsconfig.base.json and bunx effect-tsgo diagnostics --project packages/server/tsconfig.json reports 0 errors and 0 warnings
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Shared: new errors.ts with Schema.TaggedError classes (AuthError, NotFoundError, ConflictError, ValidationError, BlockLockedError) + ApiError union
2. Declare error: ApiError on every Rpc.make in shared/api.ts (every endpoint goes through auth, so every endpoint can fail with the union)
3. Server handlers: replace the 29 Effect.fail(new Error(...)) sites with the tagged errors; move AuthError from workspace-context to shared
4. rpc-handlers: swap Effect.orDie for a single dieUnlessApiError combinator so declared errors stay typed and everything else remains a defect (the tolerated minimum)
5. Edges: map tagged errors to statuses in api-v1/response.ts handle() and in the REST/proxy catchAllCause of index.ts
6. Client: rpc-client decodes the typed failure and drops the looksLike403 string heuristic; BlockEditor keys off _tag/holderUserId instead of parsing BlockLocked:<id>
7. Re-enable globalErrorInEffectFailure/globalErrorInEffectCatch, then bun run quickcheck + lint:effect + biome
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- Taxonomy lives in packages/shared/src/errors.ts as Schema.TaggedError classes (AuthError, NotFoundError, ConflictError, ValidationError, BlockLockedError) + the ApiError union, isApiError = Schema.is(ApiError), and ApiCause = Schema.Cause({ error: ApiError }) for client-side decoding.

- All 68 Rpc.make entries declare error: ApiError; rpc-handlers swapped its 69 Effect.orDie for dieUnlessApiError, so declared failures stay typed and everything else keeps dying.

- permissions.ts stopped borrowing api-v1's REST ApiError: denials are AuthError(403), missing targets NotFoundError, ACL revision conflicts ConflictError. Without this the client's AccessDeniedError path would have regressed to a defect.

- Client decodes the serialized cause with Schema.Cause + Cause.failureOption; the looksLike403 substring heuristic and the BlockLocked:<id> message parsing in BlockEditor are gone.

- Verified against a booted server: a typed failure now arrives as {"_tag":"Fail","error":{...,"_tag":"AuthError"}} inside the Exit, not as an opaque Defect.
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: @claude
created: 2026-08-05 20:04
---
Sizing (from the tsgo install pass): 29 sites, 3 buckets — 16x "X not found", 7x conflict/validation, 5x REST JSON-parse in index.ts, 1x rewrap (workspaces.ts:43). Key constraint: rpc-handlers.ts pipes all 69 handlers through Effect.orDie, so today every failure crosses the RPC boundary as an opaque defect ({}), and the app toasts String(e). BlockLockedError is the existing precedent for a tagged class with an own message field that survives. So a pure swap to tagged errors silences the two rules but changes nothing user-visible; the valuable version also declares error: schemas on the ~24 affected Rpc.make entries, drops orDie there, and lets the client discriminate on _tag (BlockEditor.tsx:1001 currently string-matches "BlockLocked"). Server tests assert no error messages, so regression risk is low.
---
<!-- COMMENTS:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Typed the API's error contract end to end and re-enabled the two Effect diagnostics that flagged the untagged failures.

What changed:
- New packages/shared/src/errors.ts: AuthError, NotFoundError, ConflictError, ValidationError and BlockLockedError as Schema.TaggedError classes, the ApiError union, isApiError (Schema.is) and ApiCause (Schema.Cause) so both sides share one definition.
- Every Rpc.make declares error: ApiError. rpc-handlers.ts replaces its 69 blanket Effect.orDie calls with dieUnlessApiError: declared failures stay in the error channel, anything else (SqlError, bugs, missing headers) still becomes a defect.
- 29 Effect.fail(new Error(...)) sites in handlers/, export/page.ts and index.ts now fail with the matching tagged error. permissions.ts no longer borrows api-v1's REST ApiError: 403s are AuthError, missing targets NotFoundError, ACL revision conflicts ConflictError.
- New http-error.ts maps a failed request to a JSON response once: typed failures keep their own status (401/403/404/409/400) and are no longer reported to PostHog as incidents; everything else stays a reported 500. The seven duplicated catchAllCause blocks in index.ts and api-v1's handle() both go through it.
- Client: rpc-client decodes the serialized cause with Schema.Cause + Cause.failureOption instead of the looksLike403 substring heuristic; BlockEditor keys off BlockLockedError.holderUserId instead of parsing 'BlockLocked:<id>' out of a message.

User impact: a missing page answers 404 instead of 500, a lock refusal and a permission denial are distinguishable by type on the client, and expected 4xx stop polluting error tracking.

Tests: new packages/server/test/api-errors.test.ts (17 cases: handler failure types via Effect.flip, dieUnlessApiError keeping/dying, encode-decode round trip per error, status mapping). Full gate green — bun run pre-merge (223 server + 64 app + 17 shared + 6 electron tests, biome, effect diagnostics 0 errors/0 warnings on all packages, bundle size).

Note: the bundle-size baseline was refreshed (app JS +11.4 KB raw / +3.1 KB gzip, +0.46%, from shipping the error schemas and cause decoding to the browser; the tracked filenames were also stale).
<!-- SECTION:FINAL_SUMMARY:END -->
