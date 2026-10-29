---
id: NOT-37
title: 'Calendar view: week/day time-window modes'
status: wontfix
assignee: []
created_date: '2026-06-18 20:31'
updated_date: '2026-06-19 16:11'
labels:
  - enhancement
dependencies: []
priority: low
ordinal: 42000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Consider letting users choose the calendar's time window (month/week/day) instead of month-only. NOTE: database date fields are currently date-only (<input type="date">, no time-of-day stored), so an hourly day/week timeline would render nothing meaningful — this is only worth building if date fields gain a time component first. Month view covers the common all-day-event case. Captured from review discussion; deferred.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Decision recorded on whether date fields should carry time-of-day
- [ ] #2 If pursued: month/week/day toggle in the calendar toolbar
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Triage: Calendar view week/day time-window modes

**Category:** Feature Request
**Priority:** P4 — Low
**Product area:** Calendar / UI

### Issue Summary
Request to add week/day time-window modes to the calendar view, giving users the ability to toggle between month, week, and day views.

### Key Details
- **Customer context:** Internal product decision captured from review discussion
- **Impact:** Cosmetic — month view covers the common all-day-event case
- **Workaround:** Month view is available and sufficient
- **Related tickets:** N/A
- **Known issue:** No

### Assessment
The database date fields are currently date-only (<input type='date'>, no time-of-day stored), so hourly day/week timelines would render nothing meaningful. This feature is only worth building if date fields gain a time component first. Month view already covers the common case. Deferred indefinitely — marked as wontfix.

### Decision Rationale
1. No time-of-day data stored in DB — day/week timelines would be empty
2. Month view suffices for all-day events (current use case)
3. Would require upstream work (date+time fields) before feasible
4. Low value relative to effort at this stage
<!-- SECTION:PLAN:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: @thomas
created: 2026-06-19 16:11
---
Triage decision: wontfix. Database stores date-only fields (no time-of-day), so day/week timelines would render empty. Month view covers the current all-day-event use case. Would need date+time fields upstream before this is feasible — low priority, deferred indefinitely.
---
<!-- COMMENTS:END -->
