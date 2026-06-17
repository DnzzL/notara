---
id: NOT-31
title: Fix 'Calculate' table footer column alignment in database view
status: ready for agent
assignee: []
created_date: '2026-06-17 13:15'
labels:
  - frontend
dependencies: []
ordinal: 36000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The table footer row (tfoot) showing aggregate calculations (Count, Sum, Average, etc.) has mismatched padding and alignment compared to data rows. The ColumnFooter component uses height: 32, paddingRight: 8, and justifyContent: flex-end, while data cells above use px-2 py-1.5 with different alignment. The title column footer in particular doesn't respect custom column widths.

Fix: Align footer cell layout (td padding, text position, width constraints) with their corresponding data columns so the 'Calculate' text and aggregate values sit in the same horizontal position as the cell content above.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Footer aggregate values are horizontally aligned with their respective column's content
- [ ] #2 Custom column widths are respected in the footer row
- [ ] #3 The footer row is visually consistent with the data rows (padding, font size)
<!-- AC:END -->
