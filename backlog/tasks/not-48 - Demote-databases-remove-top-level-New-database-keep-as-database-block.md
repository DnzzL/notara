---
id: NOT-48
title: 'Demote databases: remove top-level ''New database'', keep as /database block'
status: done
assignee:
  - '@thomas'
created_date: '2026-07-10 15:38'
updated_date: '2026-07-10 15:47'
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
- [x] #1 Sidebar no longer shows 'New database' as a top-level creation action; 'New page' is the single primary create action
- [x] #2 A database can still be created inside a page via the /database slash command
- [x] #3 Existing standalone databases continue to open and render correctly (no data migration)
- [x] #4 Server and app type-checks pass; existing tests green
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Investigation finding: the ticket's premise was incorrect. There is no top-level 'New database' action in the app — Sidebar.tsx's only creation action is 'New page' (grep for database/new database in Sidebar returns nothing). Databases are created solely via the /database slash command (blockTypes.ts:114, shortcut '/database'), which calls createDatabase(currentPage.id, 'Untitled') inline in the current page (BlockEditor.tsx:615-617). So the desired end-state — write first, databases only via '/' inside a page — already holds. No code change required.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
No code change — target state already implemented.

NOT-48 aimed to remove a top-level 'New database' sidebar peer so users start by writing, with databases reachable only via /database inside a page. On investigation, the app already works exactly this way:
- No 'New database' action exists in the sidebar (only 'New page') or anywhere else in the UI.
- The /database slash command (blockTypes.ts) creates an inline database in the current page (BlockEditor.tsx handleSlashCommand).

The ticket originated from an incorrect assumption in the initial high-level UX scan (that databases were a top-level peer). All ACs are satisfied by existing code; no diff, no test impact.
<!-- SECTION:FINAL_SUMMARY:END -->
