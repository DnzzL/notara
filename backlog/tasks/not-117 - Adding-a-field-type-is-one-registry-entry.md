---
id: NOT-117
title: Adding a field type is one registry entry
status: ready-for-agent
assignee: []
created_date: '2026-08-26 11:12'
updated_date: '2026-08-26 11:14'
labels:
  - enhancement
dependencies:
  - NOT-114
  - NOT-115
  - NOT-116
priority: high
ordinal: 112000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
CONTRACT STEP of a wide refactor. Delete the old form now that no caller remains.

Remove the leftover comparison chains on field type across the views, the query engine, the server handlers and the import paths. Remove the standalone metadata maps left behind by the migration batches.

Then close the hole that made this refactor invisible to the compiler in the first place: every site comparing a field type currently compares a plain string, so none of the eighteen touchpoints ever produced a type error. Type them against the union so that adding a member to it fails compilation anywhere that has not handled it.

Done means: adding a field type is one registry entry, and the compiler finds every place that still needs attention.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 No comparison chain on field type remains anywhere in the codebase
- [ ] #2 Field type is typed as the union at every comparison site, not as a plain string
- [ ] #3 Adding a member to the union produces compilation errors at every place that must handle it
- [ ] #4 A new field type can be added by writing one registry entry, demonstrated by adding a type end to end in the process
- [ ] #5 Both type-check commands pass, and the database, board and visual-regression E2E specs are green
<!-- AC:END -->
