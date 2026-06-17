---
id: NOT-32
title: Fix '+' add-column button positioning in database table header
status: done
assignee:
  - '@thomas'
created_date: '2026-06-17 13:15'
updated_date: '2026-06-17 14:05'
labels:
  - frontend
dependencies: []
ordinal: 37000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The '+' button to add a new column is in a <th style="width: 40"> that sits after all sortable field <th> elements inside a horizontally-scrollable container. When scrolling horizontally through many columns, the '+' button doesn't feel attached to the last column — it's anchored at the far end of the table, disconnected from the column headers.

Fix: Make the '+' button sticky to the right edge of the visible header area using position: sticky with right: 0 and appropriate background to overlay the scrollable area. Alternatively, adjust the layout so it appears immediately adjacent to the last visible column header.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The '+' button appears immediately to the right of the last visible column header
- [x] #2 The button remains visible when scrolling horizontally through columns
- [x] #3 The button does not overlap or clip with the last column header's content
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Locate the '+' add-column button in DatabaseView.tsx\n2. Add position: sticky with right: 0 and a background so it sticks to the right edge of the visible header area when scrolling horizontally\n3. Ensure it doesn't overlap or clip with the last column header
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Made '+' add-column <th> sticky with right:0 and var(--bg) background so it stays visible when scrolling horizontally. Also made the corresponding empty <td> in rows and tfoot sticky to match.
<!-- SECTION:NOTES:END -->
