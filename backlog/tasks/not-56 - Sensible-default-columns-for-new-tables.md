---
id: NOT-56
title: Sensible default columns for new tables
status: ready-for-agent
assignee: []
created_date: '2026-07-19 19:40'
labels:
  - enhancement
dependencies: []
priority: medium
ordinal: 59000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A freshly-created database currently has no user-facing columns and a hidden title (packages/server/src/handlers/databases.ts:95-109, title_hidden=1), so inserting a table shows an empty, confusing surface. Default to a simple list: a visible Name column plus one text column, grid view. Part of the simple-first tables direction (#4).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Creating a database yields a visible Name/title column plus one empty text column by default
- [ ] #2 New database opens in a grid view with those columns visible (no manual 'Show column' step required)
- [ ] #3 No relation/people/rollup columns are added by default
<!-- AC:END -->
