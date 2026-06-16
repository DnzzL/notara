---
id: NOT-25.2
title: 'Consolidate CSS — Slice 2: Migrate sidebar/page-node CSS (AFK)'
status: ready for agent
assignee: []
created_date: '2026-06-16 16:34'
labels:
  - enhancement
dependencies: []
parent_task_id: NOT-25
priority: high
ordinal: 27000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Migrate all sidebar and page-node CSS classes from styles.css to Tailwind v4 utilities in the React components. Remove the migrated CSS from styles.css after confirming no regressions.

CSS classes to migrate: .page-node, .page-node-*, .workspace-switcher, .workspace-switcher-*, .sidebar-*, .sidebar-drag-*, .sidebar-collapse-btn, .sidebar-action-btn, .page-fav-*, .page-delete-btn, .page-menu-*, .page-node-menu-*, .side
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 All .page-node CSS migrated to Tailwind utilities in sidebar/page components
- [ ] #2 All .workspace-switcher CSS migrated to Tailwind utilities
- [ ] #3 All .sidebar-*, .page-menu-*, .page-fav-* CSS migrated to Tailwind utilities
- [ ] #4 Migrated CSS removed from styles.css
- [ ] #5 No visual regressions — sidebar renders identically before/after
<!-- AC:END -->
