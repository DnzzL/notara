---
id: NOT-30
title: Allow marking a saved database view as default
status: ready for agent
assignee: []
created_date: '2026-06-17 13:15'
labels:
  - database
dependencies: []
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
- [ ] #1 User can toggle one saved view as the 'default' view via a pin/star icon in the view switcher dropdown
- [ ] #2 When a default view is set, opening the database automatically loads that view instead of 'All'
- [ ] #3 Only one view can be default at a time — setting a new default clears the previous one
- [ ] #4 The default view selection persists across page reloads
- [ ] #5 bun --bun tsc --noEmit passes
<!-- AC:END -->
