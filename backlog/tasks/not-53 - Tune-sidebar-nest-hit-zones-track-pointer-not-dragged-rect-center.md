---
id: NOT-53
title: 'Tune sidebar nest hit-zones: track pointer, not dragged-rect center'
status: done
assignee:
  - '@thomas'
created_date: '2026-07-10 16:32'
updated_date: '2026-07-10 16:33'
labels:
  - enhancement
dependencies: []
priority: medium
ordinal: 56000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Follow-up to NOT-52. The vertical-thirds nest/reorder zones are hard to hit because zoneFor uses the dragged element's center-Y (offset by the grab point) instead of the actual cursor position, so the zone doesn't track where the user is pointing. Track the live pointer Y during drag and compute the zone from it, and widen the nest band (30/40/30) so the primary action is more forgiving.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Zone is computed from the live cursor Y relative to the hovered row, not the dragged element's center
- [x] #2 Nest band is the middle ~40% of the row (top ~30% before, bottom ~30% after), making nesting easier to land
- [x] #3 App type-check clean for Sidebar.tsx
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
zoneFor now reads a live pointerYRef (updated by a window pointermove listener active only during drag) instead of active.rect.current.translated center. Thresholds widened to 0.3/0.7 (top 30% before, middle 40% nest, bottom 30% after). Guards div-by-zero on height. Verify: app tsc clean for Sidebar.tsx; no server change.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Tune the sidebar nest/reorder hit-zones so they track the cursor.

The zones were computed from the dragged element's center-Y, which is offset by wherever the row was grabbed, so the active zone didn't line up with the cursor. Now the zone is computed from the live pointer Y (a pointermove listener that runs only during a drag) relative to the hovered row, and the nest band is widened to the middle 40% (top/bottom 30% reorder). Alt still force-nests.

One file (Sidebar.tsx); app type-check clean; no server change.
<!-- SECTION:FINAL_SUMMARY:END -->
