---
id: NOT-188
title: 'Block nesting: drag-and-drop and Move up/down carry the subtree'
status: needs-triage
assignee: []
created_date: '2026-11-11T23:01:00Z'
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
- [ ] #1 Dragging or moving a block with children moves the whole subtree
- [ ] #2 Dropping a block at a different indentation changes its parent
<!-- AC:END -->
