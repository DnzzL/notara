---
id: NOT-31
title: Fix 'Calculate' table footer column alignment in database view
status: done
assignee:
  - '@thomas'
created_date: '2026-06-17 13:15'
updated_date: '2026-06-17 14:06'
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
- [x] #1 Footer aggregate values are horizontally aligned with their respective column's content
- [x] #2 Custom column widths are respected in the footer row
- [x] #3 The footer row is visually consistent with the data rows (padding, font size)
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Examine ColumnFooter component in DatabaseView.tsx to understand current layout\n2. Align footer cell padding/alignment with data cell classes (px-2 py-1.5)\n3. Make the footer title column respect custom column widths\n4. Ensure visual consistency between footer and data rows
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Fixed ColumnFooter alignment: removed fixed height:32 and paddingRight:8, added Tailwind padding classes (px-2 py-1.5 for title, px-2 py-[3px] for fields) matching data cells. Footer title now respects custom column widths.
<!-- SECTION:NOTES:END -->
