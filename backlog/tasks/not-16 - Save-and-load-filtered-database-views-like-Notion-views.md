---
id: NOT-16
title: Save and load filtered database views (like Notion views)
status: ready for agent
assignee: []
created_date: '2026-06-16 16:05'
updated_date: '2026-06-16 16:08'
labels:
  - frontend
  - database
  - feature
  - enhancement
dependencies: []
priority: medium
ordinal: 16000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Currently filters, sorts, board group-by, and hidden fields exist only in-memory per database in the Zustand store. There is no way to save a combination as a named view and reload it later. The API already has a listViews endpoint and the shared types include DatabaseView, and hydrateView can apply a view — but there's no UI to create, name, switch, or delete views. This is a major parity gap vs Notion.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Build a view switcher UI above the database (dropdown showing saved views + 'Add view')
- [ ] #2 Add 'Save as view' action that persists current filters/sorts/group-by/hidden-fields as a named view via the API
- [ ] #3 Loading a saved view applies all its settings (filters, sorts, board configuration)
- [ ] #4 Support renaming and deleting saved views from the switcher
- [ ] #5 Default view ('All') always exists and cannot be deleted
<!-- AC:END -->
