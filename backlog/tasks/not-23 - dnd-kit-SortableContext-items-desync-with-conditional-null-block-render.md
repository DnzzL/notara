---
id: NOT-23
title: dnd-kit SortableContext items desync with conditional null block render
status: ready for agent
assignee: []
created_date: '2026-06-16 16:14'
labels:
  - bug
dependencies: []
references:
  - packages/app/src/components/BlockEditor.tsx
priority: medium
ordinal: 23000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Potential React-vs-DOM reconciliation conflict in the block list. In BlockEditor.tsx, SortableContext is given items=allItems.map(item => item.id) (line ~836), where allItems contains an id for every sorted block. But the render map (lines ~933-938) does 'if (block.type === "database") { const db = databases.find(...); if (!db) return null; }'. When an inline database block points to a missing/deleted database, its id remains in the SortableContext items array but no SortableBlock (and thus no useSortable/setNodeRef DOM node) is mounted for it. dnd-kit then tracks an ordered id with no registered DOM node, which during drag measurement/reordering can dereference an unmounted or never-mounted node (rect reads on null, index misalignment, or React removeChild on a node dnd-kit moved). Same desync risk applies if orphan-database ids in allItems (db-<id>) ever fail to render a matching SortableBlock.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 SortableContext items array always matches exactly the set of SortableBlock nodes actually mounted in the DOM (no id without a mounted node, no mounted node without an id)
- [ ] #2 An inline database block referencing a missing/deleted database no longer leaves a dangling id in the sortable list (either it is filtered out of allItems consistently, or it renders a real placeholder SortableBlock)
- [ ] #3 Dragging blocks on a page that contains a database block with a missing target does not throw or misplace blocks
- [ ] #4 App type-check passes (ignoring pre-existing errors)
<!-- AC:END -->
