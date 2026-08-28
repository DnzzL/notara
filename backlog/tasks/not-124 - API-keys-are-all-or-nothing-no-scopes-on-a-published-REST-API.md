---
id: NOT-124
title: 'API keys are all-or-nothing: no scopes on a published REST API'
status: done
assignee:
  - '@thomas'
created_date: '2026-08-26 13:28'
updated_date: '2026-08-27 16:10'
labels:
  - enhancement
dependencies: []
priority: medium
ordinal: 119000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
An API key authenticates as its owner and carries every right that user has. There is no scope column on api_keys and no scope check anywhere, so a key handed to a CI job, a script or a third-party integration can delete workspaces just as readily as it can list pages.

That is a normal limitation for an internal token and an awkward one for a published REST API shipped with a CLI, which is what /api/v1 becomes at launch. 'Give me a read-only key' is the first thing an integrator asks for.

Surfaced while deciding what to take from the composable policy pattern in NOT-104. Relations cannot express this: a scope is a property of the CREDENTIAL, not of the user's relationship to a resource. This is the one case in the codebase that would genuinely want the domain:action permission vocabulary that NOT-104 deliberately left out — permissions carried on the principal, which is exactly what an API key is.

The Policy module is already shaped for it: CurrentUser would gain a scopes field and a scope(...) policy would sit alongside the relation policies, composed with all(). No restructuring needed, which is why this was left out rather than built speculatively.

Worth deciding before the REST API is advertised, since adding scopes afterwards means either breaking existing keys or grandfathering them as unscoped forever.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A key can be created with a scope narrower than its owner's rights, at minimum read-only versus full
- [x] #2 Scope is enforced for every REST operation, not only the ones remembered at review time
- [x] #3 Keys created before scopes existed keep working, with their treatment stated explicitly rather than left implicit
- [x] #4 The scope a key carries is visible in the key list so its holder can tell what it can do
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
DECIDED before implementation.

Granularity: read / write, nothing else. It covers the actual request — a read-only key for CI — and ADR-008 already said a permission vocabulary only earns its place if an axis escapes relations. Scopes are that axis, but an axis with two values. Per-resource scopes for a three-noun API would be a selection UI nobody reads before ticking everything.

Existing keys become write keys. The migration names what they already are rather than inventing a grandfathered state to carry forever — there is no "unscoped key" in the model, only write keys. The key list shows the scope, so their reach becomes visible to someone who had not thought about it.

Enforcement is ONE chokepoint: the v1 router refuses any non-GET carried by a read key. Not a scope() policy per operation — that is 28 places to forget, which is precisely the shape of NOT-102, and the operation table that would let them be declared together does not exist.

The invariant that makes the chokepoint safe: no GET mutates. True today (the GETs are list, get, search, trash). It must be written down and tested, because it is an assumption someone can break later without noticing they depend on it.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
API keys now carry a scope: a read key may only issue GET requests, a write key can do anything its owner can.

Why: a key authenticated as its owner and carried every right that user had, so a key handed to a CI job could delete a workspace as readily as list pages. Adding scopes after keys exist in the wild means either breaking them or grandfathering an unscoped state forever, so this lands before the public REST surface has integrators.

Changes:
- Migration platform/004 adds api_keys.scope with DEFAULT 'write' and a CHECK. Existing keys become write keys — the default names what they already are; there is no 'unscoped key' in the model.
- api-v1/scope.ts is the single chokepoint. enforceScope runs from handle(), which every v1 route already goes through, so a new route is covered when registered rather than when someone remembers. mutates() fails closed: an unanticipated verb counts as a mutation.
- The chokepoint is sound only while a GET never mutates. test/api-key-scopes.test.ts asserts that invariant against the real route registration rather than trusting it.
- Scope flows through the shared schema, the createApiKey RPC, and the settings panel: a select at creation, a badge in the key list (the scope is fixed at creation, so the holder needs to see it).
- OpenAPI documents the 403 a read key gets.

Tests: 244 server tests pass; e2e/rest-api-key-scopes.spec.ts proves over the wire that a read key gets 403 on a POST, writes nothing, still reads, and that a write key still mutates (so the refusal is not passing vacuously).
<!-- SECTION:FINAL_SUMMARY:END -->
