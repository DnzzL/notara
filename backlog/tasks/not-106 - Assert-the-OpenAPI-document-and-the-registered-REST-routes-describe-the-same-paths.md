---
id: NOT-106
title: >-
  Assert the OpenAPI document and the registered REST routes describe the same
  paths
status: ready-for-agent
assignee: []
created_date: '2026-08-26 11:11'
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
- [ ] #1 A test fails when a route is registered but absent from the OpenAPI document
- [ ] #2 A test fails when the OpenAPI document declares a path with no registered route
- [ ] #3 The comparison covers the HTTP method as well as the path
- [ ] #4 The test names the offending paths in its failure output rather than reporting a bare count mismatch
<!-- AC:END -->
