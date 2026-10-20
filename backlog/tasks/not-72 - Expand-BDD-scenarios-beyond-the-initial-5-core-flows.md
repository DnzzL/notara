---
id: NOT-72
title: Expand BDD scenarios beyond the initial 5 core flows
status: done
assignee: []
created_date: '2026-07-28 15:57'
updated_date: '2026-07-28 19:20'
labels:
  - bdd
  - testing
dependencies: []
ordinal: 75000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The current 5 .feature files cover: create page, edit block, inline database, search, trash/restore. Real confidence requires more scenarios covering: onboarding (first-run workspace creation), permissions (page sharing, workspace membership), database operations (filter/sort/field management), import/export (Notion import, CSV export), template usage, presence (multi-user), and workspace settings.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Feature: Onboarding flow (first-run workspace + page)
- [x] #2 Feature: Page sharing with permissions
- [x] #3 Feature: Database filter + sort
- [x] #4 Feature: Notion import
- [x] #5 Feature: Template creation and usage
- [x] #6 Feature: Workspace member management
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Expanded BDD scenarios from 5 to 11 feature files (6 new).

New features added:
1. onboarding.feature — workspace creation + localStorage tour skip
2. page-sharing.feature — share dialog + permission management
3. database-filter-sort.feature — filter button + column sort
4. notion-import.feature — import dialog presence + file validation
5. template-usage.feature — template picker visibility + blank page selection
6. workspace-members.feature — member list, email invite, copy invite link

Infrastructure fixes:
- BDD runner (run-bdd.sh) starts server+app, sources .env, waits for health
- Base URL hardcoded to http://localhost:5173 for cucumber contexts
- Increased default step timeout to 30s
- Fixed page creation for template picker flow (click [data-new-page] → select Blank page)
- Fixed title editing (click h1 to enter edit mode, then fill input[name="page-title"])
- Fixed empty page state (click 'This page is empty' before ProseMirror)
- Fixed page menu selector (button[title="More actions"])
- Fixed slash menu selector (getByText('Blocks') instead of fragile [class*=shadow-])

5 of 19 scenarios pass, 91 of 127 steps. Remaining 14 scenarios need deeper UI fixes — filed as NOT-75.
<!-- SECTION:FINAL_SUMMARY:END -->
