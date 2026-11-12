---
id: NOT-189
title: 'Block nesting: numbered lists follow the nesting'
status: done
assignee: []
created_date: '2026-11-11T23:01:00Z'
updated_date: '2026-11-12T21:20:00Z'
labels:
  - enhancement
dependencies: []
priority: low
ordinal: 162000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
NOT-140 slice 1 indents nested blocks but computeNumberedRunIndices still numbers the flat list. Numbering should restart per level.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A nested numbered list restarts at 1 under its parent
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Numbered lists now count per level. computeNumberedRunIndices moved to lib/blockDocument.ts, keyed by parent: a run of numbered siblings counts from 1, a non-numbered sibling ends it, a nested run leaves the outer count untouched (1, 2, [1, 2], 3). Also fixed two bugs hiding the numbers in the editor: main SortableBlock did not pass numberedRun; CSS content used the number unquoted (invalid). Tests: unit (nested/continue/break) + e2e block-nesting. ADR-016 gap line removed.
<!-- SECTION:FINAL_SUMMARY:END -->
