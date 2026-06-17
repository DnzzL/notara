---
id: NOT-25.4
title: 'Consolidate CSS — Slice 4: Migrate database table CSS (AFK)'
status: done
assignee: []
created_date: '2026-06-16 16:34'
updated_date: '2026-06-17 14:03'
labels:
  - enhancement
dependencies: []
parent_task_id: NOT-25
priority: high
ordinal: 29000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Migrate all database table CSS from styles.css to Tailwind v4 utilities in the React components. Remove the migrated CSS from styles.css after confirming no regressions.

CSS classes to migrate: .db-table, .db-col-*, .db-cell-*, .db-row-*, .db-drag-*, .db-title-*, .db-select, .db-add-*, .db-empty-row, .db-menu-*, .db-new-record-*, .db-footer-row, .db-people-chip, .db-relation-chip, .db-page-chip, .people-block-*, .record-panel-*, .record-panel-*
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 All .db-table and .db-* CSS migrated to Tailwind utilities
- [x] #2 All .people-block-* CSS migrated
- [x] #3 All .record-panel-* CSS migrated
- [x] #4 Migrated CSS removed from styles.css
- [x] #5 No visual regressions — database table renders identically before/after
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Replace .db-table, .db-table-row, .db-row-dragging, .db-* CSS classes with Tailwind in DatabaseView.tsx
2. Replace .db-cell-popover, .db-page-chip, .db-relation-chip, .db-people-chip CSS with Tailwind in CellComponents.tsx
3. Replace .db-col-header, .db-col-*, .db-menu-item CSS with Tailwind in FieldComponents.tsx
4. Replace .record-panel-* CSS with Tailwind in RecordPanel.tsx
5. Replace .people-block-* CSS with Tailwind in people-block.tsx
6. Replace .db-select CSS with Tailwind in BoardView.tsx
7. Remove migrated CSS from styles.css
8. Verify no regressions
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Migrated all database table CSS from styles.css to Tailwind v4 utilities:
- DatabaseView.tsx: All .db-table, .db-table-row, .db-* CSS classes replaced with Tailwind
- CellComponents.tsx: .db-cell-popover*, .db-page-chip, .db-relation-chip, .db-people-chip, .db-cell-popover-search, .db-cell-popover-list, .db-cell-popover-item replaced with Tailwind
- FieldComponents.tsx: .db-col-header, .db-col-header-content, .db-col-arrow, .db-col-drag-handle, .db-col-resize-handle, .db-menu-item, .db-menu-item--danger, .db-menu-item--active replaced with Tailwind
- RecordPanel.tsx: All .record-panel* CSS replaced with Tailwind
- people-block.tsx: All .people-block* CSS replaced with Tailwind
- BoardView.tsx: .db-select replaced with Tailwind
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Migrated all database table CSS (NOT-25.4 Slice 4) from styles.css to Tailwind v4 utilities. Classes migrated: .db-table, .db-table-row, .db-row-dragging, .db-drag-header, .db-drag-cell, .db-drag-handle, .db-row-open-btn, .db-delete-btn, .db-title-display, .db-title-input, .db-cell, .db-title-cell, .db-cell-content, .db-add-col-btn, .db-new-record-btn, .db-add-row, .db-footer-row, .db-empty-row, .db-select, .db-col-header, .db-col-header-content, .db-col-arrow, .db-col-drag-handle, .db-col-resize-handle, .db-menu-item, .db-cell-popover, .db-page-chip, .db-relation-chip, .db-people-chip, .people-block*, .record-panel*. Files modified: DatabaseView.tsx, CellComponents.tsx, FieldComponents.tsx, RecordPanel.tsx (full rewrite), people-block.tsx (full rewrite), BoardView.tsx.
<!-- SECTION:FINAL_SUMMARY:END -->
