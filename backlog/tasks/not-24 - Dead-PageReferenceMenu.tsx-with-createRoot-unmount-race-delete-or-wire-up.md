---
id: NOT-24
title: Dead PageReferenceMenu.tsx with createRoot unmount race (delete or wire up)
status: ready-for-human
assignee: []
created_date: '2026-06-16 16:14'
updated_date: '2026-07-10 08:14'
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

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Triage: Dead PageReferenceMenu.tsx with createRoot unmount race

**Category:** Bug / Tech Debt
**Priority:** Low — confirmed (dead code, no user-facing impact)
**Product area:** Editor

### Issue Summary
PageReferenceMenu.tsx exports a React createRoot-based render function, but BlockEditor.tsx actually imports from PageReferenceExtension.ts (the vanilla-DOM implementation). The entire React file is dead code with a latent race condition: it calls popup.remove() synchronously after createRoot().unmount(), which can trigger React's 'removeChild not a child of this node' error. It also has a stale-closure bug in handleKeyDown.

### Key Details
- **Impact:** Zero user-facing impact — the file is dead code, nothing imports it
- **Workaround:** N/A — the vanilla popup already handles this
- **Related tasks:** No duplicates found
- **Known issue:** No

### Routing Recommendation
**Route to:** Product decision (human) → then Engineering
**Why:** Two viable paths with different trade-offs:
- **(a) Delete the file** — Simple cleanup. The vanilla-DOM implementation works and is the live code. This removes ~200 lines of dead code and a latent bug.
- **(b) Adopt the React menu** — Intended as a richer replacement but was never wired in. Would need to fix the unmount-order race and stale-closure bug, remove the vanilla duplicate, and wire into BlockEditor. More work, debatable value.

### Assessment
The 'needs human validation' status is correct — this genuinely needs a human decision. My recommendation: **delete the file (option a)**. The vanilla popup works, the React version isn't wired in and has known defects. Keeping dead code with latent bugs is tech debt with no upside.

### Recommended Action
→ Keep in **needs human validation** pending decision. If human picks (a) delete, move to ready for agent (trivial work). If (b) adopt, move to Medium priority and ready for agent (non-trivial work).
<!-- SECTION:PLAN:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: @triage
created: 2026-06-19 16:13
---
Triage recommendation: I recommend **option (a) — delete the file**. The vanilla-DOM popup in PageReferenceExtension.ts works and is the live code. The React version in PageReferenceMenu.tsx is ~200 lines of dead code with a known unmount-order race and stale-closure bug. Keeping dead code with latent defects is pure tech debt with no upside. If you feel strongly about the React approach (option b), it'll need: (1) fix unmount→remove ordering, (2) fix stale-closure handleKeyDown, (3) wire into BlockEditor, (4) remove vanilla duplicate. That's Medium+ effort for a popup that already works.
---
<!-- COMMENTS:END -->
