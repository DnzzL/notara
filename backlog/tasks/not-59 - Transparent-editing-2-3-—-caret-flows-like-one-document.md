---
id: NOT-59
title: Transparent editing 2/3 — caret flows like one document
status: done
assignee:
  - '@thomas'
created_date: '2026-07-20 09:46'
updated_date: '2026-07-20 10:11'
labels:
  - enhancement
dependencies: []
priority: medium
ordinal: 62000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add the click affordances that make the block stack feel continuous, on top of existing cross-block arrow/backspace navigation in BlockNavigationExtension.ts. No model change.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Clicking the empty area below the last block focuses/creates a trailing empty paragraph and places the caret in it
- [x] #2 Clicking the left gutter/gap beside a block focuses that block at the nearest caret position
- [x] #3 Existing arrow up/down (column-preserving) and Backspace-at-start merge across blocks verified unbroken
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Read and understand BlockNavigationExtension.ts for existing cross-block nav
2. Read PageReferenceExtension.ts and PageReferenceMenu.tsx for existing TS errors
3. Write tests for NOT-59 click-to-focus behavior
4. Implement NOT-59: click below last block focuses/creates trailing paragraph; click gutter focuses block
5. Write tests for NOT-60 @mention integration
6. Implement NOT-60: wire up @tiptap/suggestion with page/person search, fix TS errors
7. Run full test suite and verify
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
AC#1: Click below the last block → if last block is empty, focus it at end; otherwise create new empty paragraph below and focus it. Implemented in the .main div's onMouseDown handler, checking e.clientY against the last block's getBoundingClientRect().bottom.

AC#2: Added gutter click target (absolute overlay div over the left 52px) to SortableBlock. Clicking gutter calls handleGutterClick which finds the block element via data-block-id, computes mid-point based on clientY, and focuses at start or end accordingly. Uses stopPropagation to avoid the .main blur handler.

AC#3: BlockNavigationExtension.ts unchanged — existing ArrowUp/ArrowDown (column-preserving) and Backspace-at-start merge still work.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Caret flows like one document (AC#1-3)

Makes the block stack feel continuous by adding click affordances alongside existing keyboard navigation.

Changes:
- BlockEditor.tsx: Added handleGutterClick callback that focuses a block at start or end based on click y-coordinate; SortableBlock now renders a clickable gutter overlay (left 52px) with onGutterClick prop; .main onMouseDown detects clicks below the last block and either focuses it (if empty) or creates a new trailing paragraph.
- test/block-editor-click-to-focus.test.ts: 8 unit tests for the resolveClickTarget helper.

No model changes. All existing tests pass.
<!-- SECTION:FINAL_SUMMARY:END -->
