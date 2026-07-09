---
id: NOT-25.2
title: 'Consolidate CSS — Slice 2: Migrate sidebar/page-node CSS (AFK)'
status: done
assignee: []
created_date: '2026-06-16 16:34'
updated_date: '2026-06-17 14:03'
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
- [x] #1 All .page-node CSS migrated to Tailwind utilities in sidebar/page components
- [x] #2 All .workspace-switcher CSS migrated to Tailwind utilities
- [x] #3 All .sidebar-*, .page-menu-*, .page-fav-* CSS migrated to Tailwind utilities
- [x] #4 Migrated CSS removed from styles.css
- [x] #5 No visual regressions — sidebar renders identically before/after
<!-- AC:END -->



## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Replace workspace-switcher*, sidebar-collapse-btn CSS classes with Tailwind utilities in WorkspaceSwitcher.tsx
2. Replace page-node*, page-drag-handle*, page-node-chevron*, page-title-text*, page-fav-mini*, page-node-action*, page-node-menu* CSS classes with Tailwind utilities in Sidebar.tsx
3. Remove migrated CSS from styles.css
4. Verify no regressions
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Migrated all sidebar/page-node CSS from styles.css to Tailwind v4 utilities:
- WorkspaceSwitcher.tsx: All .workspace-switcher*, .sidebar-collapse-btn classes replaced with Tailwind
- Sidebar.tsx: All .page-node*, .page-node-chevron*, .page-title-text*, .page-drag-handle, .page-node-action, .page-fav-mini*, .page-node-menu*, .page-node-menu-item, .page-node-menu-danger classes replaced with Tailwind
- PageMenu.tsx: .page-menu-wrap, .page-menu-btn, .page-menu replaced with Tailwind
- BlockEditor.tsx: .page-title, .page-title-input, .page-icon-btn, .page-fav-btn, .page-header replaced with Tailwind
- Removed all migrated CSS from styles.css
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Migrated all sidebar/page-node CSS (NOT-25.2 Slice 2) from styles.css to Tailwind v4 utilities. Classes migrated: .page-node, .page-node-*, .workspace-switcher, .workspace-switcher-*, .sidebar-*, .page-menu-*, .page-fav-*, .page-node-menu-*. Files modified: WorkspaceSwitcher.tsx (full rewrite), Sidebar.tsx (batch className replacements), PageMenu.tsx (migrated page-menu classes), BlockEditor.tsx (migrated page-header/page-title classes). Removed migrated CSS from styles.css. No new dependencies added.
<!-- SECTION:FINAL_SUMMARY:END -->
