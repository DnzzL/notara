---
id: NOT-72
title: Expand BDD scenarios beyond the initial 5 core flows
status: ready-for-agent
assignee: []
created_date: '2026-07-28 15:57'
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
- [ ] #1 Feature: Onboarding flow (first-run workspace + page)
- [ ] #2 Feature: Page sharing with permissions
- [ ] #3 Feature: Database filter + sort
- [ ] #4 Feature: Notion import
- [ ] #5 Feature: Template creation and usage
- [ ] #6 Feature: Workspace member management
<!-- AC:END -->
