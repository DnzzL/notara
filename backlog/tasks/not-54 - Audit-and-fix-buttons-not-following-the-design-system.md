---
id: NOT-54
title: Audit and fix buttons not following the design system
status: done
assignee:
  - '@thomas'
created_date: '2026-07-10 16:38'
updated_date: '2026-07-10 16:40'
labels:
  - enhancement
dependencies: []
priority: medium
ordinal: 57000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Several user-facing action buttons bypass the ui/Button design system: PageMenu dropdown items (Share / Export as Markdown / Export with databases) have no styling and render as native buttons; a '+ New block' affordance in BlockEditor is a bare button; FieldComponents formula/new-field Cancel/Save/Create use hardcoded hex inline styles; people-block 'Done' hand-rolls the primary button. Align these to <Button>/<IconButton> or the shared menu-item convention. Bespoke dark-surface controls (DatabaseView bulk bar) are out of scope unless cleanly fixable, since DS has no dark variants.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 PageMenu Share/Export as Markdown/Export with databases items use the shared menu-item styling (match WorkspaceSwitcher)
- [x] #2 BlockEditor '+ New block' empty-state affordance no longer renders as a bare native button
- [x] #3 FieldComponents Cancel/Save/Create use <Button> variants instead of hardcoded hex inline styles
- [x] #4 people-block 'Done' uses <Button variant=primary>
- [x] #5 App type-check clean for edited files; no visual regression to already-compliant buttons
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Ran a full button audit (subagent) across all 34 files with <button>. Fixed the clear offenders: PageMenu Share/Export as Markdown/Export with databases (were unstyled native buttons) now use a shared MENU_ITEM class matching WorkspaceSwitcher; BlockEditor '+ New block' empty-state is now <Button variant=secondary size=sm tabIndex=-1> (visual affordance; the wrapping div still handles the click); FieldComponents Cancel/Save/Create dropped hardcoded #2eaadc/#e9e9e7 inline styles for <Button> secondary/primary/primary (Create now truly disabled when name empty, via the DS disabled style); people-block 'Done' -> <Button variant=primary>. Deliberately left alone: ark-ui Menu/Dialog triggers, drag handles, tree rows, formatting/tab toggles (need active-state), emoji/icon pickers, dedicated-CSS auth/consent/pdf controls, small inline ✕ remove controls, and the DatabaseView bulk-action bar (a bespoke DARK toolbar where light-surface DS variants clash — DS has no dark variants; out of scope). Verify: app tsc clean for all 4 edited files (only the 5 pre-existing unrelated errors remain); no server change.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Audit all buttons against the ui/Button design system and fix the offenders.

Fixed:
- PageMenu.tsx: Share… / Export as Markdown / Export with databases had no className (rendered as native buttons). Now use a shared MENU_ITEM style matching the WorkspaceSwitcher dropdown convention.
- BlockEditor.tsx: the empty-state '+ New block' bare button is now <Button variant=secondary size=sm tabIndex=-1> (visual affordance; the wrapping div keeps handling the click, so no nested interactive target).
- db/FieldComponents.tsx: formula-editor Cancel/Save and new-field Create dropped hardcoded hex inline styles (#2eaadc/#e9e9e7) for <Button> variants; Create is now properly disabled when the name is empty.
- blocks/people-block.tsx: the picker 'Done' button re-implemented the primary style; now <Button variant=primary>.

Scope/decisions: left intentionally-bespoke controls alone — ark-ui Menu/Dialog triggers, drag handles, sidebar tree rows, formatting/view tab toggles (need active-state), emoji/icon pickers, dedicated-CSS auth/consent/pdf controls, and small inline ✕ remove buttons. The DatabaseView bulk-action bar is a bespoke DARK toolbar; the DS variants assume a light surface, so it's left as-is and noted as a candidate for future dark-surface variants.

Tests: app type-check clean for the 4 edited files; no server change.
<!-- SECTION:FINAL_SUMMARY:END -->
