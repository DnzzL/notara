---
id: NOT-25.3
title: 'Consolidate CSS — Slice 3: Migrate editor/ProseMirror CSS (AFK)'
status: ready for agent
assignee: []
created_date: '2026-06-16 16:34'
labels:
  - enhancement
dependencies: []
parent_task_id: NOT-25
priority: high
ordinal: 28000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Migrate all editor and ProseMirror CSS classes from styles.css to Tailwind v4 utilities in the React components. Remove the migrated CSS from styles.css after confirming no regressions.

CSS classes to migrate: .editor, .editor .ProseMirror, .editor .ProseMirror h1/h2/h3/p/a/code/pre/blockquote/hr/img/ul/ol/li/task-list, .editor .ProseMirror .toggle-block, .editor .ProseMirror .callout-block, .bubble-menu, .slash-menu, .slash-menu-*, .empty-state, .empty-state-*, .empty-block, .add-block-bar, .sortable-block-wrapper, .block-container, .block-gutter, .drag-handle-wrapper, .block-dragging, .drag-overlay, .drag-preview, .drop-indicator
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 All .editor / .ProseMirror CSS migrated to Tailwind utilities
- [ ] #2 All bubble-menu, slash-menu CSS migrated
- [ ] #3 All empty-state, empty-block, add-block-bar CSS migrated
- [ ] #4 All block drag-and-drop CSS (.sortable-block-wrapper, .block-container, etc.) migrated
- [ ] #5 Migrated CSS removed from styles.css
- [ ] #6 No visual regressions — editor renders identically before/after
<!-- AC:END -->
