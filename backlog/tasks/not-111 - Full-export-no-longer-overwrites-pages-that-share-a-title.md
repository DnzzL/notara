---
id: NOT-111
title: Full export no longer overwrites pages that share a title
status: ready-for-agent
assignee: []
created_date: '2026-08-26 11:11'
labels:
  - bug
dependencies: []
priority: medium
ordinal: 106000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Exporting a whole workspace to a directory writes one markdown file per page, named from the sanitised page title, flat. Two pages sharing a title silently overwrite each other and the export reports success. Untested.

Titles collide constantly in practice — 'Notes', 'README', 'Meeting', or any two records of the same database exported as pages. A backup that silently drops pages is worse than one that fails.

Decide and implement a naming scheme that cannot collide, and make the export report what it wrote.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Exporting two pages with the same title produces two files, both readable
- [ ] #2 The export reports the number of files written and it matches the number of pages exported
- [ ] #3 A test exports a fixture containing colliding titles and asserts nothing is lost
<!-- AC:END -->
