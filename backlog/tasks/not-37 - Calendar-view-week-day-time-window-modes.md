---
id: NOT-37
title: 'Calendar view: week/day time-window modes'
status: needs-triage
assignee: []
created_date: '2026-06-18 20:31'
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
