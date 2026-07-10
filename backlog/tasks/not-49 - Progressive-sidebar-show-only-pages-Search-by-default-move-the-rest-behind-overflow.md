---
id: NOT-49
title: >-
  Progressive sidebar: show only pages + Search by default, move the rest behind
  overflow
status: ready-for-agent
assignee: []
created_date: '2026-07-10 15:38'
labels:
  - enhancement
dependencies: []
priority: medium
ordinal: 52000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The sidebar (Sidebar.tsx, 715 lines) exposes every capability at once (Search, Favorites, pages, Trash, Import, Templates, Members, API keys), which reads as enterprise-heavy. Apply progressive disclosure: by default show only the page tree + Search. Move Trash, Import, Templates, Members, and API keys behind a single overflow/Settings entry. No features removed — only relocated so a first-time user sees the minimum needed to start writing.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Sidebar default state shows page tree + Search (and Favorites if non-empty); nothing else at top level
- [ ] #2 Trash, Import, Templates, Members, API keys reachable via a single overflow/Settings entry point
- [ ] #3 All relocated actions remain functional (no capability removed)
- [ ] #4 App type-check passes; existing tests green
<!-- AC:END -->
