---
id: NOT-35
title: Spreadsheet-style keyboard navigation in database table view
status: needs-triage
assignee:
  - '@claude'
created_date: '2026-06-17 21:17'
updated_date: '2026-06-17 21:39'
labels:
  - enhancement
dependencies: []
priority: high
ordinal: 40000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The table view has no grid-level keyboard focus cursor: focusedCell state is declared but never used, so arrow keys do nothing unless a cell editor is already open. Add a focus cursor (ring) that moves with arrow keys / Tab, opens the editor on Enter or type-to-replace, and is restored on Escape from an editor.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A focus ring is visible on the focused cell when no editor is open
- [x] #2 Arrow keys move the focus cursor across rows and columns (including the title column)
- [x] #3 Enter opens the editor for the focused cell; Escape from an editor returns focus to that cell (not nothing)
- [x] #4 Tab / Shift+Tab move focus horizontally when not editing
- [x] #5 Typing a printable character on a focused text/number cell begins editing seeded with that character
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Make TitleCell editing controlled by parent (editing/onEditingChange/seedChar props).
2. DatabaseView: focusedCell={recordId,fieldId} ('__title__' for title col), seedChar state, navColIds memo, moveFocus, beginEditFocused.
3. Document keydown effect (focusedCell && !editingCell && not in input): arrows + Tab move focus, Enter opens editor, printable char seeds edit, Escape clears focus; scroll into view.
4. Click-to-focus on data + title cells; editor onCancel returns focus; pass seed to InlineCellEditor/TitleCell.
5. Focus ring (inset box-shadow var(--accent)).
6. Type-check packages/app.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented additive focus cursor (click-to-edit preserved). TitleCell made controlled (editing/onEditingChange/seedChar). Added navColIds/moveFocus/beginEditFocused + document keydown effect (arrows/Tab/Enter/Escape/type-to-replace) active only when a cell is focused and no editor is open. Escape from any editor returns focus to the cell. Focus ring via inset box-shadow var(--accent); focused cell scrolled into view. seedChar threaded to InlineCellEditor (text/number) and TitleCell, cleared on navigate/save/cancel. app type-check clean (only pre-existing PageReferenceExtension error remains).

Switched from additive to select-then-edit click model (user preference — Notion's edit-on-every-click is annoying). First click focuses a cell; a second click on the already-focused cell, double-click, Enter, or typing opens the editor. Applied to both data cells and the title column (TitleCell now takes isFocused). app type-check clean (only pre-existing PageReferenceMenu/import.meta errors).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Add spreadsheet-style keyboard navigation to the database table view.

What changed:
- focusedCell was dead state; it now drives a real focus cursor. A focus ring (inset box-shadow, --accent) marks the focused cell whenever no editor is open.
- Arrow keys and Tab/Shift+Tab move the cursor across rows and columns, including the title column; the focused cell auto-scrolls into view.
- Enter opens the editor for the focused cell; typing a printable character opens it seeded with that char (type-to-replace) for text/number/title cells.
- Escape from any cell editor now returns focus to that cell instead of clearing, so arrow nav resumes immediately.
- TitleCell converted from self-managed edit state to controlled (editing/onEditingChange/seedChar) so the title column participates in the same focus/edit model.

Click-to-edit behavior is unchanged (additive). Formula cells can be focused but stay read-only.

Files: packages/app/src/components/DatabaseView.tsx, packages/app/src/components/db/CellComponents.tsx.

Tests: app type-check passes (only the pre-existing PageReferenceExtension error remains). Not yet manually verified in a running app.

Update: click model is select-then-edit, not additive. Single click selects (focus ring); editing opens on second click of the focused cell, double-click, Enter, or type-to-replace.
<!-- SECTION:FINAL_SUMMARY:END -->
