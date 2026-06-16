---
id: NOT-20
title: Mobile hamburger menu toggle is broken — sidebar drawer does not open
status: ready for agent
assignee: []
created_date: '2026-06-16 16:05'
updated_date: '2026-06-16 16:08'
labels:
  - frontend
  - mobile
  - bug
dependencies: []
priority: high
ordinal: 20000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The mobile topbar has a hamburger button that claims to toggle the sidebar drawer open/closed via the sidebarOpen state, but the sidebar never actually slides into view. Investigate whether the CSS transform on .sidebar is being overridden by another rule, whether the dnd-kit SortableContext is interfering with position:fixed, or whether the sidebar--open class is failing to apply. The responsive CSS is present (width: 80vw, transform: translateX(-100%) → translateX(0)) but the hamburger appears non-functional.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Identify why the sidebar--open class does not result in a visible sidebar on mobile
- [ ] #2 Fix the root cause (CSS cascade, layout stacking, or state issue)
- [ ] #3 Verify that tapping the hamburger opens the sidebar drawer and tapping the backdrop closes it
- [ ] #4 Test on viewports < 880px
<!-- AC:END -->
