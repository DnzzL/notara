---
id: NOT-28
title: Block context menu cannot be dismissed by clicking outside
status: done
assignee:
  - '@thomas'
created_date: '2026-06-17 09:51'
updated_date: '2026-06-17 09:59'
labels:
  - ux
  - bug
dependencies: []
references:
  - packages/app/src/components/BlockContextMenu.tsx
priority: medium
ordinal: 33000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Once the block context menu is opened (via drag-handle click or right-click), clicking elsewhere on the page does not close it. The mousedown listener on the document fires, but the event that opened the menu may also be captured, making the first click ineffective. The menu should close reliably on any click outside the menu.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Clicking anywhere outside the block context menu closes it on the first click
- [x] #2 Escape key still closes the menu
- [x] #3 Clicking a menu item still closes the menu and fires its action
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. In packages/app/src/components/BlockContextMenu.tsx: The document mousedown listener fires but the event that opened the menu (drag-handle click/right-click) may also be captured, making the first click outside ineffective\n2. Fix by using requestAnimationFrame to defer adding the document listener, so any events triggered by opening the menu don't immediately close it\n3. Alternative: use a ref timestamp and ignore mousedown events within a short window after mount
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- Root cause: the mousedown event that opened the menu (via drag-handle click or right-click) could also be captured by the document listener, causing the first click outside to be ineffective

- Fix: added mountedAt ref storing performance.now() on mount, and skipped mousedown events within 150ms of mount in the document listener

- Escape key still closes the menu, clicking menu items still closes and fires action
<!-- SECTION:NOTES:END -->
