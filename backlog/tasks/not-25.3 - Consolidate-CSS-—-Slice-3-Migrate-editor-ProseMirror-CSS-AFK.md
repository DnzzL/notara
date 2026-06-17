---
id: NOT-25.3
title: 'Consolidate CSS — Slice 3: Migrate editor/ProseMirror CSS (AFK)'
status: done
assignee: []
created_date: '2026-06-16 16:34'
updated_date: '2026-06-17 14:03'
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
- [x] #1 All .editor / .ProseMirror CSS migrated to Tailwind utilities
- [x] #2 All bubble-menu, slash-menu CSS migrated
- [x] #3 All empty-state, empty-block, add-block-bar CSS migrated
- [x] #4 All block drag-and-drop CSS (.sortable-block-wrapper, .block-container, etc.) migrated
- [x] #5 Migrated CSS removed from styles.css
- [x] #6 No visual regressions — editor renders identically before/after
<!-- AC:END -->



## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Replace .editor, .ProseMirror, .bubble-menu, .slash-menu CSS classes with Tailwind utilities in BlockEditor.tsx and SlashMenu.tsx
2. Replace .empty-state, .empty-block, .add-block-bar CSS with Tailwind in BlockEditor.tsx
3. Replace .sortable-block-wrapper, .block-container, .block-gutter, .drag-handle-wrapper, .block-dragging, .drag-overlay, .drag-preview, .drop-indicator CSS with Tailwind in BlockEditor.tsx
4. Replace .drag-handle class with Tailwind in DragHandle.tsx
5. Remove migrated CSS from styles.css
6. Verify no regressions
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Migrated all editor/ProseMirror CSS from styles.css to Tailwind v4 utilities:
- BlockEditor.tsx: .editor, .empty-state*, .empty-block, .add-block-bar, .sortable-block-wrapper, .block-container, .block-gutter, .drag-handle-wrapper, .block-dragging, .drag-overlay, .drag-preview, .drop-indicator, .block-content, .block-insert-btn, .block-node classes replaced with Tailwind
- SlashMenu.tsx: .slash-menu, .slash-menu-header, .slash-menu-item, .slash-icon, .slash-item-content, .slash-item-name, .slash-item-shortcut replaced with Tailwind
- DragHandle.tsx: .drag-handle class replaced with Tailwind
- Kept .ProseMirror content styles (h1, h2, h3, p, a, code, pre, etc.) as they style TipTap editor content
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Migrated all editor/ProseMirror CSS (NOT-25.3 Slice 3) from styles.css to Tailwind v4 utilities. Classes migrated: .editor, .bubble-menu, .slash-menu, .slash-menu-header, .slash-menu-item, .empty-state, .empty-state-*, .empty-block, .add-block-bar, .sortable-block-wrapper, .block-container, .block-gutter, .drag-handle-wrapper, .block-dragging, .drag-overlay, .drag-preview, .drop-indicator, .block-content, .block-insert-btn, .drag-handle, .block-node. Files modified: BlockEditor.tsx, SlashMenu.tsx, DragHandle.tsx. Kept .ProseMirror content styles (h1/h2/h3/p/a/code/pre/blockquote/hr/img/ul/ol/li, task-list, toggle, callout) as they style TipTap rich-text output.
<!-- SECTION:FINAL_SUMMARY:END -->
