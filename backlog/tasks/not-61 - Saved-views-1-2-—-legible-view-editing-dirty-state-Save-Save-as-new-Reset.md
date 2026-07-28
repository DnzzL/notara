---
id: NOT-61
title: >-
  Saved views 1/2 — legible view editing (dirty-state: Save / Save as new /
  Reset)
status: done
assignee:
  - '@thomas'
created_date: '2026-07-20 10:05'
updated_date: '2026-07-20 14:07'
labels:
  - enhancement
dependencies: []
priority: high
ordinal: 64000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Views already persist name/type/groupByFieldId/sortFieldId/sortOrder/config(filters)/isDefault, and updateView/createView exist. What's missing is a legible editing affordance: today it's ambiguous whether QueryBar tweaks stick to the active view. Add a dirty-state on the active view offering Save (updateView), Save as new (createView), and Reset. Frontend-only, reuses existing RPCs. Keeps views centralized on the database definition (no per-page config).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Changing filters/sorts/grouping/type on the active view surfaces a visible 'modified' indicator
- [x] #2 Save persists the current query state to the active view; a reload shows the saved state
- [x] #3 Save as new creates a new named view capturing the current state and switches to it
- [x] #4 Reset reverts the active view to its last-saved config
- [x] #5 A view with no pending changes shows no modified indicator (clean state)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
All 5 ACs implemented: dirty indicator (blue dot), Save, Save as new, Reset, clean state. viewType dirty detection bug fixed post-code-review. Merged to main.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented saved-view dirty-state detection (filters/sorts/groupBy/boardHidden/viewType) with blue ● indicator, Save (updateView), Reset (revert to saved), and Save as new (createView). Added 9 tests for all dirty/clean scenarios.
<!-- SECTION:FINAL_SUMMARY:END -->
