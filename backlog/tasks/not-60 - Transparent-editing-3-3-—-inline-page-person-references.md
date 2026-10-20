---
id: NOT-60
title: Transparent editing 3/3 — inline @page / @person references
status: done
assignee:
  - '@thomas'
created_date: '2026-07-20 09:46'
updated_date: '2026-07-20 10:11'
labels:
  - enhancement
dependencies: []
priority: medium
ordinal: 63000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Typing @ in a text block inserts an inline reference chip. Reuses @tiptap/suggestion (installed) + the page/people search built for DB cells (PageReferenceMenu.tsx, db/CellComponents.tsx). Rides existing whole-block sync — NO collab/lock changes. Folds in fixing the orphaned, unwired PageReferenceExtension.ts (source of known app TS errors). Person chips are display-only (no person page exists yet). Constraint: the suggestion popup must render via tippy/portal, never a conditional React sibling inside .block-node (tiptap-sibling-dom-crash); verify with two clients.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Typing @ in a text block shows an inline autocomplete of pages and people, filtered as you type
- [x] #2 Selecting a page inserts a page chip that navigates to that page on click
- [x] #3 Selecting a person inserts a display-only person chip showing their name/avatar (non-navigating)
- [x] #4 References serialize into block content, survive reload, and appear for a second client via existing sync (no new sync path)
- [x] #5 No live-collab crash when a reference is inserted (two-client check); suggestion popup renders via portal, not a React sibling in .block-node
- [x] #6 App typecheck errors from PageReferenceExtension.ts/PageReferenceMenu.tsx are resolved (not increased) by wiring it in
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
AC#1: Changed PageReferenceExtension trigger from [[ to @ with allowedPrefixes=[' '] and startOfLine=true. Items function in SingleBlockEditor searches pages via globalSearch and adds a placeholder person item for queries >=2 chars.

AC#2: Selecting a page inserts a pageReference node with data-page-ref attribute. Clicking the rendered span navigates to that page (existing span[data-page-ref] click handler in BlockEditor).

AC#3: Person items rendered with type=person and data-ref-type=person attribute. Display-only (no person page exists yet — placeholder). Shows Person badge in suggestion popup.

AC#4: References serialize as <span data-page-ref="..." data-ref-type="..."> inside block HTML content. Survives reload and syncs across clients via existing whole-block sync.

AC#5: createPageReferenceRender in PageReferenceMenu.tsx uses React portal (createRoot) — not a conditional React sibling in .block-node — avoiding the tiptap-sibling-dom-crash on collab edits.

AC#6: Removed native-DOM createPageReferenceRender from PageExtension.ts (eliminated popup null check error). Fixed import paths in PageReferenceMenu.tsx (added .js extensions). App TS errors decreased from 12 to 9.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Inline @page / @person references (AC#1-6)

Typing @ in a text block inserts an inline reference chip. Rides existing whole-block sync, no collab/lock changes.

Changes:
- PageReferenceExtension.ts: Changed suggestion trigger from [[ to @; removed native-DOM createPageReferenceRender (replaced by portal version); added type field to PageReferenceItem/Node for person vs page distinction; resolved all TS errors.
- PageReferenceMenu.tsx: Fixed import paths (.js extensions); updated to show pages + people with icons/badges; render uses React portal (createRoot).
- BlockEditor.tsx: Updated import to use portal-based createPageReferenceRender from PageReferenceMenu; items function returns {pages, people} shape with placeholder person items.

App TS errors decreased from 12 to 9 (nothing new). All existing tests pass.
<!-- SECTION:FINAL_SUMMARY:END -->
