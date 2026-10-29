---
id: NOT-29
title: Fix board/table view mode not persisting with saved database views
status: done
assignee:
  - '@thomas'
created_date: '2026-06-17 13:15'
updated_date: '2026-06-17 14:10'
labels:
  - database
dependencies: []
ordinal: 34000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When you create a board-type saved view and switch to it, the UI stays in table mode because the viewType state in the DatabaseView component is decoupled from the store's switchView action. The view persists filters/sorts/group-by but never toggles the table vs board render mode.

Specifically: ViewSwitcher.handleSaveAs saves viewType and boardGroupByFieldId in the view, but switchView only restores filters/sorts/boardHidden/groupBy — it never updates the viewType in DatabaseView's useState. The board/table toggle buttons also only write to localStorage, they don't persist the mode into any view.

Fix: When switchView applies a saved view, also update the viewType (table/board) stored in the view's type field. When toggling board/table mode, persist the choice so it survives page reload.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Switching to a board-type saved view renders the board layout instead of staying in table mode
- [x] #2 Switching to a table-type saved view renders the table layout
- [x] #3 Toggling board/table mode persists across page reload
- [x] #4 bun --bun tsc --noEmit passes
<!-- AC:END -->



## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Read ViewSwitcher.tsx to understand save/switchView flow\n2. Fix switchView to update viewType in DatabaseView's useState when loading a saved view\n3. Fix board/table toggle buttons to persist the choice through the store/view, not just localStorage\n4. Verify bun --bun tsc --noEmit passes
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Fixed switchView to update viewType: added effect that syncs viewType when activeViewId changes, looking up the saved view's type field. Toggle buttons now persist to localStorage AND update the active saved view's type via updateView. Used string state type to avoid TS union narrowing issues.
<!-- SECTION:NOTES:END -->
