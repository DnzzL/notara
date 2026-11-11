---
id: NOT-185
title: API versioning and deprecation policy
status: ready-for-agent
assignee: []
created_date: '2026-11-11T13:21:00Z'
labels:
  - enhancement
milestone: m-6
dependencies: []
priority: high
ordinal: 158000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Why: 1.0 means integrators can rely on the API. State the rule and enforce it: /api/v1 is frozen, changes are additive only, removals follow a deprecation window.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A doc states: /api/v1 frozen, additive changes only, deprecation window length and how deprecations are announced
- [ ] #2 A committed snapshot of /openapi.json exists
- [ ] #3 A test fails on a breaking change to /openapi.json versus the snapshot (removed path/field, narrowed type, new required input)
- [ ] #4 An additive change passes the test, with a documented way to update the snapshot
<!-- AC:END -->
