---
id: NOT-77
title: 'Popover doesn''t reposition when its content grows, pushing Create off-screen'
status: needs-triage
assignee: []
created_date: '2026-07-30 13:43'
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
- [ ] #1 Popover recomputes its position when its content size changes (e.g. ResizeObserver), not only when triggerRect changes
- [ ] #2 Adding a Select field with 3+ options keeps the Create button inside the viewport and clickable at 1280x720
- [ ] #3 A popover that would overflow the bottom after growth flips above the trigger or becomes internally scrollable, with the Create action always reachable
<!-- AC:END -->
