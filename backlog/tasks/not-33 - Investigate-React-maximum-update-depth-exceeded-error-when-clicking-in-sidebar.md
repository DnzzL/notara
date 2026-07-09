---
id: NOT-33
title: Investigate React maximum update depth exceeded error when clicking in sidebar
status: done
assignee:
  - '@thomas'
created_date: '2026-06-17 13:15'
updated_date: '2026-06-17 13:56'
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
- [x] #1 Root cause of the infinite update loop is identified and documented
- [x] #2 Fix is implemented to prevent the error from occurring
- [x] #3 No regressions in sidebar navigation
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Understand the project structure and sidebar components
2. Start dev server and reproduce the error using agent-browser with React DevTools enabled
3. Use agent-browser react tree/inspect to identify the component chain causing the loop
4. Fix the infinite update cycle
5. Verify fix
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
ROOT CAUSE FOUND: Two issues identified:

1. **PRIMARY - Stale snapshot in selectDbViews (causes infinite loop)**: In databaseStore.ts, the `selectDbViews` selector returns `[]` (bare array literal) instead of a stable empty reference like all other selectors do. This causes React's `useSyncExternalStore` to detect a snapshot change on every render, leading to 'Maximum update depth exceeded' in the `<ViewSwitcher>` component.

2. **SECONDARY - Invalid HTML nesting**: DndContext inside <thead>/<tr> renders a <div> child of <tr>, which is invalid HTML. This causes hydration warnings but is not the main error.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Fix maximum update depth error in ViewSwitcher and HTML nesting in DatabaseView.

Root cause 1: selectDbViews selector returned bare [] instead of stable EMPTY_VIEWS constant, causing useSyncExternalStore infinite loop detection in React 18.

Root cause 2: DndContext inside tr tag created invalid HTML nesting, causing hydration warnings.

Fixed by adding EMPTY_VIEWS constant and merging nested DndContext into outer one.
<!-- SECTION:FINAL_SUMMARY:END -->
