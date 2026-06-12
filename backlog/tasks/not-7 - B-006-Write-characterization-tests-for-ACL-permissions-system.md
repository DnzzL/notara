---
id: NOT-7
title: 'B-006: Write characterization tests for ACL/permissions system'
status: ready for agent
assignee: []
created_date: '2026-06-12 13:55'
updated_date: '2026-06-12 14:05'
labels:
  - enhancement
dependencies: []
references:
  - packages/server/src/handlers/permissions.ts
priority: medium
ordinal: 7000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The entire Zanzibar-style ACL system (resolveEffectiveRelation, checkPagePermission, checkBlockPermission, filterPagesByPermission, writePagePermissions, etc.) has zero tests. This ~480-line module is the most architecturally complex subsystem.\n\nFile: packages/server/src/handlers/permissions.ts\n\nCover: workspace owner always passes, member with no ACL = editor, explicit viewer/editor/owner grants, ancestor ACL inheritance, blocked-by-ancestor, subject matching (user:, workspace:#member, public), write + readback roundtrip, revision bumps.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 At least 10 tests covering ACL resolution scenarios
- [x] #2 Tests use the existing TestDbLayer pattern from handlers.test.ts
- [x] #3 bun test packages/server/test passes with new tests
<!-- AC:END -->
