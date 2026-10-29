---
id: NOT-56
title: Sensible default columns for new tables
status: ready-for-human
assignee:
  - '@thomas'
created_date: '2026-07-19 19:40'
updated_date: '2026-07-21 15:21'
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
- [x] #1 Creating a database yields a visible Name/title column plus one empty text column by default
- [x] #2 New database opens in a grid view with those columns visible (no manual 'Show column' step required)
- [x] #3 No relation/people/rollup columns are added by default
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Modified createDatabase handler in packages/server/src/handlers/databases.ts to:
- Set title_hidden = 0 (Name column now visible by default)
- Create a default 'Notes' text field
- Create a default 'Grid' table view marked as default

Updated integration test assertions in packages/server/test/handlers.test.ts to account for the new defaults.
Added dedicated unit tests in packages/server/src/handlers/databases.test.ts for the new behavior.

All 42 integration tests pass, all 16 unit tests pass.
<!-- SECTION:NOTES:END -->
