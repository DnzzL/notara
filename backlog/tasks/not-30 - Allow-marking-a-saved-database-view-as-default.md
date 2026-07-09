---
id: NOT-30
title: Allow marking a saved database view as default
status: done
assignee:
  - '@thomas'
created_date: '2026-06-17 13:15'
updated_date: '2026-06-20 11:09'
labels:
  - database
dependencies: []
priority: medium
ordinal: 35000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Currently, opening a database always defaults to the 'All' view. Users should be able to select one saved view as the default, so it loads automatically on page visit.

Implementation scope:
- Add an isDefault boolean field to the DatabaseView shared type and DB schema (nullable, unique per database — only one view can be default)
- UI: Add a pin/star icon next to each saved view in the view switcher dropdown to toggle it as default
- Logic: When loadDbViews completes and no active view is explicitly selected, if a default exists, switch to it automatically
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 User can toggle one saved view as the 'default' view via a pin/star icon in the view switcher dropdown
- [x] #2 When a default view is set, opening the database automatically loads that view instead of 'All'
- [x] #3 Only one view can be default at a time — setting a new default clears the previous one
- [x] #4 The default view selection persists across page reloads
- [x] #5 bun --bun tsc --noEmit passes
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Triage: Allow marking a saved database view as default

**Category:** Feature Request
**Priority:** Medium (was unset — setting to Medium)
**Product area:** Database

### Issue Summary
Users can save views (filters, sorts, group-by) via NOT-16, but opening a database always defaults to the 'All' view. This feature allows marking one saved view as default, so it loads automatically on page visit. Well-scoped: add isDefault field to schema, pin/star UI toggle in view switcher, auto-load logic after loadDbViews.

### Key Details
- **Impact:** UX improvement — saves a click for power users who always want a specific filtered view
- **Workaround:** Click the saved view manually every time
- **Related tasks:** NOT-16 (save/load views — done), NOT-29 (view mode persistence — done)
- **Known issue:** No duplicates — related to NOT-16 but distinct scope
- **Dependencies:** None — NOT-16 and NOT-29 are complete

### Routing Recommendation
**Route to:** Engineering
**Why:** Well-scoped feature with clear implementation steps (schema change, UI toggle, auto-load logic). Type-check gate (--noEmit) is already in AC.

### Assessment
Setting priority to **Medium**. This is a natural next step after the saved-views foundation (NOT-16) and view-mode persistence (NOT-29). The implementation is well-defined, the AC are clear, and it's a clean self-contained feature. Not urgent (Low candidate) but has clear user value and is naturally sequenced after the view framework is in place. Medium balances impact vs urgency.

### Recommended Action
→ Move to **ready for agent** with Medium priority. No human decision block.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Post-release bug fix (AC #3 was not actually enforced): updateView's clear-previous-default query referenced cur.databaseId, but the SELECT returned database_id unaliased, so cur.databaseId was undefined and the UPDATE matched no rows. Result: multiple views could be is_default=1 in the same database; on reload views.find(v=>v.isDefault) returned the oldest, so the wrong/no default appeared to load ('last view stays, not the default'). Fix: alias database_id as "databaseId" in the SELECT (databases.ts updateView). createView was unaffected (uses req.databaseId). Added regression tests (one-default-per-database on update path + cross-database isolation). Verified in a local session; 167 server tests pass + clean server type-check.

Second fix (layout/default interaction, found via live debugging):
- Symptom: a saved view named 'Board' opened showing a Table; layout tabs silently rewrote the active view's stored type (changeViewType -> updateView({type})), so a view's name/layout drifted apart and the default opened with the wrong layout.
- Root cause of why a naive 'lock' didn't work: switching layout tabs unmounts/remounts the ViewSwitcher (it lives inside BoardView/CalendarView vs the inline table). Its mount effect calls loadDbViews, whose auto-select fired on EVERY mount (guard was '!activeViewId'), so it re-applied the default after any deselect. This also made an explicit 'All' non-sticky.
- Fixes:
  1) loadDbViews auto-selects the default only on first load for a db (activeViewIdByDb[id] === undefined) instead of any falsy value, so it no longer re-applies on ViewSwitcher remounts or over an explicit 'All' (stored as null).
  2) changeViewType (DatabaseView) now deselects the active saved view (switchView(null) -> ad-hoc 'All' in the chosen layout) instead of rewriting the view's stored type; CalendarView's duplicate updateView({type}) removed (delegates to parent). A saved view's layout is now fixed.
- Verified in a live session: default loads correct layout on reload; clicking a layout tab drops to ad-hoc without changing the saved view's stored type; 'All' is sticky within a session and reload returns to the default. App type-check clean (only pre-existing errors).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Add ability to mark a saved database view as default, auto-loading it on page visit.

Changes:
- Schema: Added isDefault field to DatabaseView class
- Migration: Added is_default column to database_views table
- Server mapper: Updated VIEW_COLS and viewFromRow for is_default/isDefault
- Server handler: createView/updateView accept isDefault; server-enforced uniqueness (only one default per database)
- RPC handlers: Plumb isDefault through to database handlers
- API schema: Added optional isDefault to createView/updateView RPC payloads
- Store: Added setDefaultView action; loadDbViews auto-selects the default view if none is active
- UI: Added star toggle button in ViewSwitcher dropdown - click to set/unset a view as default

Only one view per database can be default at a time. Default persists across reloads.
<!-- SECTION:FINAL_SUMMARY:END -->
