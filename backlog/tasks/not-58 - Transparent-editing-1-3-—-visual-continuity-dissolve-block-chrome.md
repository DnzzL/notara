---
id: NOT-58
title: Transparent editing 1/3 — visual continuity (dissolve block chrome)
status: done
assignee:
  - '@thomas'
created_date: '2026-07-20 09:46'
updated_date: '2026-07-20 09:56'
labels:
  - enhancement
dependencies: []
priority: high
ordinal: 61000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Blocks stay the storage/collab/lock unit; make the surface READ as one document. Pure CSS + tiny markup, no model change. Fixes: per-block hover tint outlines boxes (BlockEditor.tsx:617); consecutive list-item blocks show gaps; numbered lists render 1.1.1. because each item is its own <ol> with no shared counter. Non-goals: cross-block selection, list-as-a-unit, any sync change.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Hovering any block no longer paints a per-block background; the gutter handle still appears on hover
- [x] #2 Consecutive same-type list blocks (bullet, numbered, todo) collapse the inter-block gap to list-item spacing; paragraph-to-paragraph spacing is unchanged
- [x] #3 A run of N numbered-list blocks displays 1..N; inserting a non-numbered block mid-run restarts numbering at 1 for the following run (CSS counter on the blocks container)
- [x] #4 No regression to drag handle, drop indicator, or locked-block styling
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Write TDD tests for SortableBlock rendering changes (no hover tint, gutter still visible, data attributes)
2. Remove hover:bg-[rgba(0,0,0,0.015)] from SortableBlock's group div in BlockEditor.tsx (AC#1)
3. Add CSS rules to collapse gaps between consecutive same-type list blocks (AC#2)
4. Add numbered run index computation in BlockEditor render and CSS counter rules (AC#3)
5. Verify no regressions to drag handle, drop indicator, locked-block styling (AC#4)
6. Run full test suite and verify
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
AC#1: Removed hover:bg-[rgba(0,0,0,0.015)] from SortableBlock's group div. Gutter handle (drag handle + + button) still appears on hover via group-hover:opacity-100 on the gutter container.

AC#2: Added CSS rules to styles.css that collapse the py-px gap between consecutive same-type list blocks (bullet, numbered, todo). Uses adjacent sibling combinator (+) and :has(+ selector) for both the top padding of the second block and bottom padding of the first block in a run.

AC#3: Added computeNumberedRunIndices() utility that assigns sequential indices to numberedList blocks, resetting to 1 when a non-numbered block interrupts a run. The index is passed to SortableBlock as a CSS custom property (--numbered-run). CSS replaces the default <ol> marker with ::before content using the custom property, with tabular-nums for stable alignment.

AC#4: Drag handle, drop indicator (DropIndicator component), locked-block styling (.block-node--locked) all unchanged.

All changes are CSS + tiny markup (CSS custom property on block wrapper), no model changes.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Transparent editing 1/3 — visual continuity (dissolve block chrome)

Removes per-block hover tint, collapses gaps between consecutive same-type list blocks, and replaces numbered-list block markers with a computed run index that resets on run boundaries.

Changes:
- BlockEditor.tsx: Removed hover:bg-[rgba(0,0,0,0.015)] from SortableBlock; added computeNumberedRunIndices() utility and wired it into the render loop; SortableBlock accepts numberedRun prop and exposes it as --numbered-run CSS custom property.
- styles.css: Added CSS for gap collapsing between same-type list blocks (:,has(+), + combinators on data-block-type attributes) and numbered list counter display (replaces default <ol> marker with ::before using var(--numbered-run)).
- test/block-editor-visual-continuity.test.ts: 7 unit tests for computeNumberedRunIndices.

No model changes. All existing tests pass.
<!-- SECTION:FINAL_SUMMARY:END -->
