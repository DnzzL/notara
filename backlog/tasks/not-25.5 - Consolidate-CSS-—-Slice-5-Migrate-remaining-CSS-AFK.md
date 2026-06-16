---
id: NOT-25.5
title: 'Consolidate CSS — Slice 5: Migrate remaining CSS (AFK)'
status: ready for agent
assignee: []
created_date: '2026-06-16 16:34'
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
- [ ] #1 All .import-modal-* CSS migrated to Tailwind utilities
- [ ] #2 All .page-reference-* CSS migrated
- [ ] #3 All .backlinks-* CSS migrated
- [ ] #4 All .page-link-block-* CSS migrated
- [ ] #5 Migrated CSS removed from styles.css
- [ ] #6 No visual regressions — modals, references, backlinks render identically before/after
<!-- AC:END -->
