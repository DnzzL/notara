---
id: NOT-96
title: Mid-item Enter in a list or todo can duplicate the text into both blocks
status: needs-triage
assignee: []
created_date: '2026-08-19 12:47'
labels:
  - bug
dependencies: []
priority: medium
ordinal: 91000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Splitting a list or todo item mid-text (Enter with the caret inside the text) hands the before/after halves to splitBlock, but does not truncate the current editor's own content. The block's pending debounced save then lands after the split and writes the whole pre-split line back, leaving the text in both blocks. The paragraph/heading/quote branch was fixed under NOT-84 by calling setContent(before, false) before splitBlock; the list and todo branches of the same Enter handler still carry the race (packages/app/src/components/BlockNavigationExtension.ts).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Enter mid-text in a bullet or numbered list item leaves the head in the first item and the tail in the new one
- [ ] #2 Same for a todo item
- [ ] #3 An e2e spec covers both, alongside the paragraph cases in e2e/editor-enter.spec.ts
<!-- AC:END -->
