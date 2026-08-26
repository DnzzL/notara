---
id: NOT-106
title: >-
  Assert the OpenAPI document and the registered REST routes describe the same
  paths
status: done
assignee:
  - '@thomas'
created_date: '2026-08-26 11:11'
updated_date: '2026-08-26 14:02'
labels:
  - enhancement
dependencies: []
priority: medium
ordinal: 101000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The OpenAPI document in packages/server/src/api-v1/openapi.ts is written and maintained by hand — its own header says so — and is not derived from anything. It currently matches the routes registered in api-v1/routes.ts by discipline alone. Nothing asserts it.

A published REST API whose spec silently drifts from its routes is worse than no spec: consumers build against paths that do not exist, or miss paths that do. The CLI in packages/cli is exactly such a consumer.

Small ticket, no dependencies, disproportionate leverage. It catches the drift that actually bites, and it stays useful as a guard after the later operation-table work makes the document derived rather than hand-written.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A test fails when a route is registered but absent from the OpenAPI document
- [x] #2 A test fails when the OpenAPI document declares a path with no registered route
- [x] #3 The comparison covers the HTTP method as well as the path
- [x] #4 The test names the offending paths in its failure output rather than reporting a bare count mismatch
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
The route table is collected by running the real registerV1Routes effect against a router that records instead of serving, so the test reads the same source of truth the server does rather than a copy that could drift on its own. This is also the first test in the repo to import registerV1Routes at all.

Two normalisations were needed and are the reason a naive comparison would not have worked: the document declares paths relative to its servers[0].url (/workspaces, not /api/v1/workspaces), and OpenAPI spells parameters {workspaceId} where the router spells them :workspaceId.

GET /api/v1/openapi.json and GET /api/docs are excluded by name: they are the document and its viewer, part of the deployment rather than of the described API.

Current state: 28 registered routes, 28 documented operations, exact match. Verified to fail by renaming one spec path — both directions reported, each naming the offending path. A third test asserts both lists are non-empty, so a spec that failed to load cannot make the comparison vacuously green.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Assert the OpenAPI document and the registered routes describe the same paths.

api-v1/openapi.ts says in its own opening line that it is hand-written and derived from nothing. Its eighteen path entries matched the routes actually registered by discipline alone, with nothing asserting it. For a published REST API shipped with a CLI consumer, silent drift means integrators building against paths that do not exist, or never learning about paths that do.

Changes:
- packages/server/test/openapi-parity.test.ts: runs the real route registration against a recording router, normalises the two spellings (relative spec paths against servers[0].url, and {param} against :param), and compares both directions — registered-but-undocumented and documented-but-unserved — naming the offending paths in the failure message rather than reporting a count mismatch.
- A guard test asserts both lists are non-empty, so a spec that failed to load cannot pass vacuously.

Verified: 28 routes, 28 documented operations, exact match today. The test was confirmed to fail in both directions by renaming a single spec path.

Side effect worth noting: registerV1Routes now has a test importing it. That surface previously had none, which is the gap NOT-122 inherits.

Tests: 224 pass / 0 fail, server and test type-checks clean, biome clean.
<!-- SECTION:FINAL_SUMMARY:END -->
