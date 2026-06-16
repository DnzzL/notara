---
id: NOT-25.4
title: 'Consolidate CSS — Slice 4: Migrate database table CSS (AFK)'
status: ready for agent
assignee: []
created_date: '2026-06-16 16:34'
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
- [ ] #1 All .db-table and .db-* CSS migrated to Tailwind utilities
- [ ] #2 All .people-block-* CSS migrated
- [ ] #3 All .record-panel-* CSS migrated
- [ ] #4 Migrated CSS removed from styles.css
- [ ] #5 No visual regressions — database table renders identically before/after
<!-- AC:END -->
