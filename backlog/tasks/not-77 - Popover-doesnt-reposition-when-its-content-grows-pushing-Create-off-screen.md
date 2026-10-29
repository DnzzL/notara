---
id: NOT-77
title: 'Popover doesn''t reposition when its content grows, pushing Create off-screen'
status: done
assignee:
  - '@thomas'
created_date: '2026-07-30 13:43'
updated_date: '2026-07-30 14:13'
labels:
  - bug
dependencies: []
priority: high
ordinal: 80000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Popover (packages/app/src/components/db/CellComponents.tsx:75) measures its height once in a useEffect keyed only on [triggerRect]. It positions itself below the trigger and flips above if it would overflow the viewport bottom — but only using the height at mount.

AddFieldPopover grows after mount: choosing the Select or Multi-select type reveals an option editor, and each added option adds a row. The stored top is never recomputed, and because the popover is position:fixed, page scrolling cannot bring it back. The footer Create button ends up outside the viewport and is unclickable.

Found while writing E2E: Playwright reported 'element is outside of the viewport' retrying the Create click for ~30s after adding two options to a Select field, at the default 1280x720 viewport. Worked around in e2e/helpers.ts addField() by submitting via Enter in the name input instead of clicking Create.

Likely affects any Popover with post-mount growth, not just add-field — the relation type also loads its database list asynchronously (api.listAllDatabases) and grows the popover after positioning.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Popover recomputes its position when its content size changes (e.g. ResizeObserver), not only when triggerRect changes
- [x] #2 Adding a Select field with 3+ options keeps the Create button inside the viewport and clickable at 1280x720
- [x] #3 A popover that would overflow the bottom after growth flips above the trigger or becomes internally scrollable, with the Create action always reachable
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Analyze all popover usages in the app to catalog which are vulnerable to NOT-77's root cause (Popover measures height once in useEffect on [triggerRect], never recomputes)\n2. Write E2E tests in e2e/popover-positioning.spec.ts covering the AddFieldPopover (Select/Multi-select option growth, Relation async load, Advanced fold), OptionsEditor popover (incremental option addition), and SelectPopover/CellAnchoredPopover (inline option create)\n3. Each test creates a fresh DB page, opens the relevant popover, triggers content growth, and asserts the action buttons are still in the viewport and clickable\n4. Optionally add BDD Gherkin scenarios under specs/ for the popover positioning behavior
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Fix implemented and verified. 27/27 tests pass.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Fixed Popover repositioning with ResizeObserver. All 27 E2E tests pass including PF-1 through PF-6.
<!-- SECTION:FINAL_SUMMARY:END -->
