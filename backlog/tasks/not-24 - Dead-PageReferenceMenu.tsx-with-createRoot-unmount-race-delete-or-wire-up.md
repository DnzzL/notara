---
id: NOT-24
title: Dead PageReferenceMenu.tsx with createRoot unmount race (delete or wire up)
status: needs human validation
assignee: []
created_date: '2026-06-16 16:14'
labels:
  - bug
dependencies: []
references:
  - packages/app/src/components/PageReferenceMenu.tsx
  - packages/app/src/components/PageReferenceExtension.ts
  - packages/app/src/components/BlockEditor.tsx
priority: low
ordinal: 24000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
PageReferenceMenu.tsx exports a React createRoot-based createPageReferenceRender(), but BlockEditor.tsx imports createPageReferenceRender from PageReferenceExtension.ts (the vanilla-DOM implementation). So the entire React version in PageReferenceMenu.tsx is currently dead code (no importer references the component). It also contains a latent React-vs-DOM reconciliation conflict: onExit() (lines ~192-199) calls component.unmount() then popup.remove() synchronously inside a TipTap suggestion event. createRoot().unmount() schedules/commits React work on the popup subtree; immediately detaching popup with popup.remove() can leave React trying to removeChild from a node already detached -> 'Failed to execute removeChild ... not a child of this node'. It also has a stale-closure bug: handleKeyDown is captured once via useRef(fn) and never sees updated pages/selectedIndex. Decision needed: (a) this is abandoned dead code -> delete PageReferenceMenu.tsx, or (b) it is the intended UI and should replace the vanilla popup -> wire it into BlockEditor and fix the unmount-order race (unmount, defer popup.remove to a microtask/next frame, or render via a React portal owned by the tree) and the stale-closure handler.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Decision recorded: delete dead file, or adopt the React menu in place of the vanilla popup
- [ ] #2 If deleted: PageReferenceMenu.tsx removed and no imports/types dangle; vanilla popup remains the single implementation
- [ ] #3 If adopted: BlockEditor wires the React render; unmount-then-remove race fixed (no synchronous popup.remove after createRoot unmount); stale-closure keydown handler fixed; vanilla duplicate in PageReferenceExtension.ts removed
- [ ] #4 App type-check passes (ignoring pre-existing errors)
<!-- AC:END -->
