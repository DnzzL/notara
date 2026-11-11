---
id: NOT-181
title: Templates are data, not code
status: ready-for-human
assignee: []
created_date: '2026-11-11T13:21:00Z'
labels:
  - enhancement
milestone: m-3
dependencies: []
priority: medium
ordinal: 154000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Why: adding a template today means editing the ~790-line templates.ts. A template should be one declarative file. Needs a human OK first: it creates a new module boundary (template file format + loader). Confirm the format before building.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Adding a template requires one declarative file and no edit to the loader code
- [ ] #2 Existing templates are moved with no change in output, proven by a snapshot test taken before the move
- [ ] #3 The template file format is documented (contract: fields, views, sample rows, relations)
<!-- AC:END -->
