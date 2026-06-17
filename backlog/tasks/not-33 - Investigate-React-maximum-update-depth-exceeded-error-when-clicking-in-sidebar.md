---
id: NOT-33
title: Investigate React maximum update depth exceeded error when clicking in sidebar
status: needs human validation
assignee: []
created_date: '2026-06-17 13:15'
labels:
  - frontend
dependencies: []
ordinal: 38000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When clicking in the sidebar, a React error fires intermittently. React error #185 is 'Maximum update depth exceeded. This can happen when a component repeatedly calls setState inside componentWillUpdate or componentDidUpdate. React limits the number of nested updates to prevent infinite loops.'

The stack trace goes through React internals and the minified build does not reveal the exact component. Likely a useEffect or useMemo dependency chain causes a re-render loop triggered by a sidebar click - page navigation triggering a state update that triggers another navigation, etc.

Investigation steps needed:
1. Reproduce consistently
2. Identify the component chain causing the loop
3. Fix the infinite update cycle
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Root cause of the infinite update loop is identified and documented
- [ ] #2 Fix is implemented to prevent the error from occurring
- [ ] #3 No regressions in sidebar navigation
<!-- AC:END -->
