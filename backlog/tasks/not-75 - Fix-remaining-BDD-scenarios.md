---
id: NOT-75
title: Fix remaining BDD scenarios
status: needs-triage
assignee: []
created_date: '2026-07-28 19:20'
labels: []
dependencies: []
ordinal: 78000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
14 of 19 BDD scenarios still fail due to specific UI interaction issues. Fix the remaining step definitions for: database filter/sort, notion import dialog, onboarding workspace creation, page sharing dialog, search modal, trash/restore page menu, workspace settings members tab, and copy invite link.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Database filter button resolves to 8 elements — use specific parent locator
- [ ] #2 Settings page scenarios navigate and interact correctly
- [ ] #3 Page sharing dialog opens from page menu
- [ ] #4 Search modal is accessible and returns results
- [ ] #5 Trash/restore flow works with updated page menu
- [ ] #6 Copy invite link step works with clipboard API
- [ ] #7 Template picker scenario passes
- [ ] #8 Onboarding workspace creation works end-to-end
<!-- AC:END -->
