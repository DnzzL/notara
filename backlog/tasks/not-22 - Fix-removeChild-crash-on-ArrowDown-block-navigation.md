---
id: NOT-22
title: Fix removeChild crash on ArrowDown block navigation
status: done
assignee:
  - '@claude'
created_date: '2026-06-16 16:08'
updated_date: '2026-06-16 16:12'
labels:
  - bug
dependencies: []
priority: high
ordinal: 22000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Pressing ArrowDown to navigate between blocks throws 'Failed to execute removeChild on Node: The node to be removed is not a child of this node'. Root cause: BubbleMenu in BlockEditor.tsx is conditionally mounted on the 'focused' state. ArrowDown blurs the current editor, unmounting BubbleMenu; tippy.js had relocated the menu DOM node off its React parent, so React's removeChild fails. Fix: render BubbleMenu unconditionally while the editor exists and let its internal shouldShow handle visibility; remove the orphaned focused state.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 BubbleMenu is no longer conditionally mounted on the focused state
- [x] #2 Pressing ArrowDown to move between blocks does not throw a removeChild error
- [x] #3 Orphaned focused/setFocused state removed without affecting presence tracking
- [x] #4 App type-check passes (ignoring pre-existing errors)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Removed the 'focused &&' guard on BubbleMenu (BlockEditor.tsx:266); BubbleMenu now always renders while the editor exists and relies on its internal shouldShow plugin for visibility. Removed orphaned focused/setFocused useState; onFocus/onBlur retain setFocusedBlock for presence. App type-check shows only pre-existing errors (PageReferenceMenu/Extension, __root.tsx import.meta.env) per CLAUDE.md.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Fixes 'Failed to execute removeChild on Node' crash when pressing ArrowDown to navigate between blocks.

Root cause: BubbleMenu was conditionally mounted on a 'focused' state. ArrowDown blurs the source editor, flipping focused to false and unmounting BubbleMenu. TipTap v2's BubbleMenu uses tippy.js, which relocates the menu DOM node out of its React parent onto document.body, so React's unmount removeChild fails because the node is no longer where React expects it.

Change: render BubbleMenu unconditionally while the editor exists (BlockEditor.tsx) and let its built-in shouldShow handle visibility (unchanged UX: menu still only appears on a text selection in a focused editor). Removed the now-orphaned focused/setFocused state; onFocus/onBlur still call setFocusedBlock for presence tracking.

Verification: app type-check passes (only pre-existing, documented errors remain).
<!-- SECTION:FINAL_SUMMARY:END -->
