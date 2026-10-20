---
id: NOT-21
title: 'Fix sidebar page reordering: drag and drop is unreliable and hard to aim'
status: done
assignee: []
created_date: '2026-06-16 16:05'
updated_date: '2026-06-16 17:44'
labels:
  - frontend
  - sidebar
  - ux
  - bug
dependencies: []
priority: high
ordinal: 21000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The sidebar uses dnd-kit (SortableContext + DndContext) with a custom drag-over system that computes above/below/nest targets based on pointer coordinates. The three-zone targeting (above/below at left 60%, nest at right 40%) combined with closestCenter collision detection leads to unpredictable drop targets. Users report it's hard to aim where a page will land, and the drop indicator sometimes flashes in wrong positions. The shared pointerPos ref and the coordination between onDragMove and onDragOver have potential race conditions.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Replace the three-zone manual targeting with a simpler model (e.g., rely more on dnd-kit's built-in sorting and only use nest on explicit modifier key or a separate drop zone)
- [x] #2 Fix the pointerPos / dragStartPos timing issue where onDragOver can read stale coordinates
- [x] #3 Add a visual preview of where the page will land that updates reliably during drag
- [x] #4 Ensure reorder-within-siblings (same parent) works precisely — no off-by-one splice errors
<!-- AC:END -->
