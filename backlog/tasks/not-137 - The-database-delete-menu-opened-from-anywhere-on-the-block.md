---
id: NOT-137
title: The database delete menu opened from anywhere on the block
status: done
assignee: []
created_date: '2026-08-29 17:44'
updated_date: '2026-08-29 17:44'
labels:
  - bug
dependencies: []
priority: high
ordinal: 132000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
SortableBlock's onContextMenu sat on the block wrapper, which for a database block spans the whole table: toolbar, header, every row, every cell. The database menu has one item and it deletes the database, so a right-click on a cell to paste — or on touch, a finger resting on a row long enough to fire contextmenu — put a delete confirmation in front of someone who had asked for nothing.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A right-click inside a database's rows, cells, header or toolbar controls does not open the block menu
- [x] #2 The menu still opens from the database's name, in all three views and at narrow widths
- [x] #3 Other block types are unaffected, and the gutter handle still opens the menu
- [x] #4 Right-clicking the rename input leaves the browser's own menu alone
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Extracted the decision into src/lib/blockContextMenu.ts (shouldOpenBlockMenu) and pinned it with packages/app/test/block-context-menu.test.ts. For a database block the menu now opens only from .db-toolbar-name — the name is the database itself, is present in table, board and calendar and at every width, and is not somewhere a finger lands by accident. The rename <input> is excluded so a caret keeps the browser's own menu.

Verified in Chrome against the running app: swept all 73 non-name descendants of a database block with a synthetic contextmenu — none opens the menu; the name does. The trigger area went from the whole block to 0.47% of it (0.44% at 1440px, 6% at compact width, where the block is shorter). A paragraph block still opens its menu on right-click, and the gutter drag handle still opens the database menu on desktop.

145 app tests pass, tsc and biome clean.
<!-- SECTION:FINAL_SUMMARY:END -->
