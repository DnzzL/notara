---
id: NOT-17
title: 'Database columns: improve default sizing, resizing, and add a compact mode'
status: ready for agent
assignee: []
created_date: '2026-06-16 16:05'
updated_date: '2026-06-16 16:08'
labels:
  - frontend
  - database
  - ux
  - enhancement
dependencies: []
priority: medium
ordinal: 17000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Database columns use table-layout: auto and have no minimum width defaults beyond db-title-cell's min-width: 180px. The column resize handles exist but there's no mechanism for a 'compact' layout. Columns feel too wide for their content (text fields get far more space than needed) and there's no way to collapse or hide columns quickly. The default column widths should be tighter, and a compact mode toggle would help users who work with many columns.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Set sensible default column widths based on field type (e.g., text/select ~120px, number ~90px, date ~130px)
- [ ] #2 Ensure db-col-resize-handle works reliably and persists column widths per-user per-database
- [ ] #3 Add a compact mode toggle that reduces padding, font sizes, and min-widths in the table
- [ ] #4 Add a 'Hide column' option to the column header menu
<!-- AC:END -->
