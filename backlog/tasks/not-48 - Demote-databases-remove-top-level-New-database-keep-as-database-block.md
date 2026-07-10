---
id: NOT-48
title: 'Demote databases: remove top-level ''New database'', keep as /database block'
status: ready-for-agent
assignee: []
created_date: '2026-07-10 15:38'
labels:
  - enhancement
dependencies: []
priority: high
ordinal: 51000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
To feel like the simplest Notion alternative, users should start by writing, not by choosing a data model. Remove 'New database' as a top-level peer of 'New page' in the sidebar (Sidebar.tsx). Databases remain fully supported as a block inserted via the /database slash command inside a page (SlashMenu.tsx / block editor already support database blocks). No data-model or backend change — this is a surface/entry-point change only.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Sidebar no longer shows 'New database' as a top-level creation action; 'New page' is the single primary create action
- [ ] #2 A database can still be created inside a page via the /database slash command
- [ ] #3 Existing standalone databases continue to open and render correctly (no data migration)
- [ ] #4 Server and app type-checks pass; existing tests green
<!-- AC:END -->
