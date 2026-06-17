---
id: NOT-29
title: Fix board/table view mode not persisting with saved database views
status: ready for agent
assignee: []
created_date: '2026-06-17 13:15'
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
- [ ] #1 Switching to a board-type saved view renders the board layout instead of staying in table mode
- [ ] #2 Switching to a table-type saved view renders the table layout
- [ ] #3 Toggling board/table mode persists across page reload
- [ ] #4 bun --bun tsc --noEmit passes
<!-- AC:END -->
