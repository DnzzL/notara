---
id: NOT-110
title: Scope a Notion import to its own run
status: ready-for-agent
assignee: []
created_date: '2026-08-26 11:11'
updated_date: '2026-08-26 11:14'
labels:
  - bug
dependencies:
  - NOT-109
priority: high
ordinal: 105000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Two passes of the Notion importer operate on the whole workspace rather than on the import being performed.

Placeholder resolution scans blocks workspace-wide for database-reference markers, so a second import can rewrite placeholders belonging to the first. The empty-leaf prune deletes any empty page in the workspace, so a second import can delete pages the first one created — or pages the user wrote by hand between the two.

Nothing runs in a transaction, so a failure part-way leaves both the workspace and the ledger in a state no one planned.

Build on the run scope introduced by the ledger: both passes must operate only on identifiers produced by the current run.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Placeholder resolution only touches content created or updated by the current import run
- [ ] #2 The empty-page prune only considers pages created by the current import run
- [ ] #3 A failure part-way through an import leaves no half-written import behind
- [ ] #4 A test runs two imports over different fixture trees and asserts the second leaves the first's pages, databases and hand-written pages untouched
<!-- AC:END -->
