---
id: NOT-18
title: >-
  Mobile view: database tables lack responsive layout, causing excessive
  horizontal spacing
status: done
assignee: []
created_date: '2026-06-16 16:05'
updated_date: '2026-06-16 17:44'
labels:
  - frontend
  - mobile
  - database
  - bug
dependencies: []
priority: high
ordinal: 18000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
On mobile (below 880px), the database table view has no responsive treatment — columns don't collapse or become scrollable, the title column's min-width: 180px stays wide, and table-layout: auto allows columns to expand with content. The result is severe horizontal overflow with no scroll container, making databases unusable on small screens.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Make the database table horizontally scrollable on mobile (overflow-x: auto on a wrapper)
- [x] #2 Set reasonable default/max column widths for mobile so content doesn't stretch the viewport
- [x] #3 Add a responsive column strategy: at least the title column should be sticky, remaining columns scroll
- [x] #4 Verify the fix on viewport widths from 320px to 880px
<!-- AC:END -->
