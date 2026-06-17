---
id: NOT-25.5
title: 'Consolidate CSS — Slice 5: Migrate remaining CSS (AFK)'
status: done
assignee: []
created_date: '2026-06-16 16:34'
updated_date: '2026-06-17 14:03'
labels:
  - enhancement
dependencies: []
parent_task_id: NOT-25
priority: high
ordinal: 30000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Migrate all remaining component CSS from styles.css to Tailwind v4 utilities in the React components. Remove the migrated CSS from styles.css after confirming no regressions.

CSS classes to migrate: .import-modal, .import-modal-*, .page-reference-*, .backlinks-*, .backlinks-panel, .page-link-block, .page-link-block-*, .page-link-picker
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 All .import-modal-* CSS migrated to Tailwind utilities
- [x] #2 All .page-reference-* CSS migrated
- [x] #3 All .backlinks-* CSS migrated
- [x] #4 All .page-link-block-* CSS migrated
- [x] #5 Migrated CSS removed from styles.css
- [x] #6 No visual regressions — modals, references, backlinks render identically before/after
<!-- AC:END -->



## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Replace .import-modal CSS with Tailwind in ImportModal.tsx
2. Replace .page-reference-* CSS with Tailwind in PageReferenceMenu.tsx
3. Replace .backlinks-* CSS with Tailwind in BacklinksPanel.tsx
4. Replace .page-link-block*, .page-link-picker* CSS with Tailwind in page-link-block.tsx
5. Remove migrated CSS from styles.css
6. Verify no regressions
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Migrated all remaining component CSS from styles.css to Tailwind v4 utilities:
- ImportModal.tsx: All .import-modal* CSS replaced with Tailwind (using Ark UI Dialog with Tailwind classes)
- PageReferenceMenu.tsx: .page-reference-menu, .page-reference-item, .page-reference-icon, .page-reference-popup replaced with Tailwind
- BacklinksPanel.tsx: .backlinks-panel, .backlinks-header, .backlinks-icon, .backlink-item replaced with Tailwind
- page-link-block.tsx: .page-link-block, .page-link-block--missing, .page-link-block-icon, .page-link-block-title, .page-link-picker* replaced with Tailwind
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Migrated all remaining component CSS (NOT-25.5 Slice 5) from styles.css to Tailwind v4 utilities. Classes migrated: .import-modal, .import-modal-*, .page-reference, .page-reference-menu, .page-reference-menu-empty, .page-reference-item, .page-reference-popup, .backlinks-panel, .backlinks-header, .backlinks-icon, .backlink-item, .page-link-block, .page-link-block--missing, .page-link-block-icon, .page-link-block-title, .page-link-picker, .page-link-picker-input, .page-link-picker-list, .page-link-picker-item, .page-link-picker-empty. Files modified: ImportModal.tsx, PageReferenceMenu.tsx (full rewrite), BacklinksPanel.tsx, page-link-block.tsx.
<!-- SECTION:FINAL_SUMMARY:END -->
