---
id: NOT-188
title: 'Block nesting: drag-and-drop and Move up/down carry the subtree'
status: done
assignee:
  - '@claude'
created_date: '2026-11-11T23:01:00Z'
updated_date: '2026-11-12T20:58:00Z'
labels:
  - enhancement
dependencies: []
priority: medium
ordinal: 161000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
NOT-140 slice 1 nests with Tab/Shift-Tab only. Reordering (drag-and-drop, Move up/down) swaps single blocks and leaves a block's children behind; dropping a block should also be able to nest/un-nest it. See docs/adr/016-block-nesting.md.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Dragging or moving a block with children moves the whole subtree
- [x] #2 Dropping a block at a different indentation changes its parent
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
moveBlock(id,targetId,before|after) on server (RPC+REST+CLI); drag, menu and Cmd+Shift+Arrow share it.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Moving a block (drag-and-drop, Move up/down, Cmd+Shift+Arrow) now moves its whole subtree in one server operation, moveBlock(id, targetId, before|after): the block takes the target's parent (drop at another indentation re-parents) and a drop into its own subtree is refused. Exposed as RPC, REST POST /blocks/:id/move and CLI 'blocks move'. Tests: server (subtree order+parents after reload, re-parent, cycle refusal) and e2e (menu move, real drag, reload). Known gap: undo of a move restores order, not the old parent. ADR-016 updated.

Review follow-ups: a move that changes the parent is not recorded for undo; dropping onto an orphan database also goes through moveBlock.
<!-- SECTION:FINAL_SUMMARY:END -->
