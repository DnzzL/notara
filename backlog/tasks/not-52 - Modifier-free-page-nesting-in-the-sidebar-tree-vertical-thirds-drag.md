---
id: NOT-52
title: Modifier-free page nesting in the sidebar tree (vertical-thirds drag)
status: done
assignee:
  - '@thomas'
created_date: '2026-07-10 16:18'
updated_date: '2026-07-10 16:23'
labels:
  - enhancement
dependencies: []
priority: medium
ordinal: 55000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Reparenting a page under another page already works but is undiscoverable (gated behind holding Alt during drag). Make it modifier-free and predictable, Notion-style, so a plain drag can both reorder and nest. Deep trees already degrade gracefully (indent caps at MAX_VISUAL_DEPTH=6); no depth limit is added. Scope is almost entirely Sidebar.tsx: handleDragOver/handleDragEnd gain pointer-Y-within-row logic, an insertion-line indicator is added, the nest path becomes move-then-reorder (also fixing that movePage never sets sort_order), and the target auto-expands on drop. No server change (movePage, reorderPages, and cycle guards already exist).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Dragging a page onto the middle third of another page's row nests it as the last child of that page, with no modifier key
- [x] #2 Dragging onto the top third reorders as the sibling before the target; the bottom third reorders as the sibling after it
- [x] #3 A nested page gets a defined position among its new siblings (move-then-reorderPages), not an arbitrary/stale sort_order
- [x] #4 Visual feedback distinguishes the two: accent ring on the target row for nest, a horizontal insertion line for reorder
- [x] #5 On a successful nest, the target page auto-expands so the moved page is immediately visible
- [x] #6 Holding Alt/Option forces nesting onto the hovered row regardless of vertical position
- [x] #7 No nesting-depth limit is introduced; existing visual indent cap is unchanged, and dropping a page onto its own descendant is still prevented
- [x] #8 App type-check is clean for edited files; server tests remain green
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Agreed via grilling. Frontend-only (Sidebar.tsx).
1. Redefine dragOverTarget to carry a zone: 'before' | 'after' | 'nest' (derive isNest = zone==='nest'); update favorites list + DragOverlay + PageTreeNode references.
2. handleDragOver (or onDragMove): compute pointer/dragged-rect Y relative to the over row's rect -> top third=before, middle=nest, bottom=after. Alt forces 'nest'.
3. handleDragEnd: nest -> move-then-reorderPages appending as last child (fixes undefined sort_order); before/after -> reorder as sibling before/after target. Keep descendant/cycle guard.
4. PageTreeNode: keep accent ring for nest; add a horizontal insertion line for before/after zones.
5. Expand-on-drop: add target id to expandedValue after a successful nest.
6. No depth limit. Verify app tsc for Sidebar; server tests unaffected.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Frontend-only, Sidebar.tsx. Added DropZone type + zoneFor() vertical-thirds hit test (pointer via active.rect.current.translated center-Y vs over.rect thirds; Alt forces 'nest'). dragOverTarget now carries a zone. handleDragEnd: nest -> movePage then reorderPages([...existingChildren, dragged]) (append last child, also defines sort_order that movePage never set) + auto-expand target; before/after -> sibling reorder with insertIdx = overIdx or overIdx+1. Feedback: existing accent ring for nest + new horizontal insertion line (top/bottom) for reorder. Cycle/descendant guard kept (client + server). No depth limit. Verify: app tsc clean for Sidebar.tsx; no server changes (suite last green at 118/118). Known nuance: for an expanded parent, a bottom-third 'after' drop lands after the whole subtree, not visually adjacent — inherent to the thirds model chosen over Notion's horizontal-indent model. Not visually driven in-browser; interactive drag hit-zones warrant a manual/agent-browser pass.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Make page reparenting in the sidebar tree modifier-free and predictable.

Before: nesting a page under another only worked if you held Alt during a drag (undiscoverable), and movePage never set sort_order so the nested position was arbitrary.

After (Notion-style vertical-thirds, all in Sidebar.tsx):
- Drag onto the top third of a row = reorder before it; bottom third = reorder after it; middle third = nest as the target's last child. No modifier needed.
- Nesting persists a real position via move-then-reorderPages (also closes the undefined-sort_order gap on move).
- Feedback: accent ring on the row for nest, a horizontal insertion line for the reorder zones.
- On a successful nest the target auto-expands so the moved page is visible.
- Alt now force-nests onto the hovered row regardless of vertical position (superset of the old behavior).
- No nesting-depth limit added: deep trees keep degrading gracefully via the existing indent cap (MAX_VISUAL_DEPTH). Dropping onto a descendant is still prevented (client + server).

Scope: one file; no server change (movePage, reorderPages, cycle guards already existed).

Tests: app type-check clean for the edited file; server suite unaffected (unchanged; last run 118/118).

Known limitation: for an expanded parent, a bottom-third 'after' drop lands after its whole subtree rather than immediately below the row — inherent to the thirds model (we chose it over Notion's fiddlier horizontal-indent model). Recommend a manual/agent-browser pass to tune the third boundaries.
<!-- SECTION:FINAL_SUMMARY:END -->
