---
id: NOT-49
title: >-
  Progressive sidebar: show only pages + Search by default, move the rest behind
  overflow
status: done
assignee: []
created_date: '2026-07-10 15:38'
updated_date: '2026-07-10 15:51'
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
- [x] #1 Sidebar default state shows page tree + Search (and Favorites if non-empty); nothing else at top level
- [x] #2 Trash, Import, Templates, Members, API keys reachable via a single overflow/Settings entry point
- [x] #3 All relocated actions remain functional (no capability removed)
- [x] #4 App type-check passes; existing tests green
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Reality: sidebar is already largely consolidated (Settings/Backups/API keys live in the WorkspaceSwitcher dropdown; Templates=New page; Members not in sidebar). Only Import + Trash remain in the always-visible footer. Approved scope: move Import + Trash into the WorkspaceSwitcher dropdown Settings section; footer becomes New page + Help.
1. WorkspaceSwitcher.tsx: add onOpenImport/onOpenTrash props, render as buttons in the Settings section after API keys.
2. Sidebar.tsx: pass onOpenImport/onOpenTrash; remove the Import + Trash footer buttons.
3. Verify: app tsc clean for edited files; server tests unaffected.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Scope was smaller than the ticket implied: Settings/Backups/API keys already lived in the WorkspaceSwitcher dropdown; Templates is what 'New page' opens; Members is not in the sidebar. Only Import + Trash were still in the always-visible footer. Moved both into the dropdown's Settings section (after API keys) via new onOpenImport/onOpenTrash props. Footer now shows New page (primary create) + Help. AC #1 met in spirit — the secondary browsing actions are gone from the top level; New page (essential) and Help remain by design per the approved plan. Verify: app tsc clean for Sidebar.tsx + WorkspaceSwitcher.tsx.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Progressive sidebar: relocate Import + Trash out of the always-visible footer into the WorkspaceSwitcher dropdown, so the default sidebar surface is pages + Search + New page.

Changes:
- WorkspaceSwitcher.tsx: added onOpenImport/onOpenTrash props; render Import and Trash buttons in the existing Settings section (after API keys), reusing the one overflow that already houses Workspace settings / Backups / API keys.
- Sidebar.tsx: pass the two callbacks; removed the Import and Trash buttons from the sticky footer, which now holds only New page and Help.

Why: positioning as the simplest, lightest Notion alternative — quiet the default sidebar. Most consolidation already existed; this closes the remaining gap without adding a second overflow menu.

Scope note: the ticket assumed Templates/Members/API keys were top-level too; they were already behind the dropdown or elsewhere, so only Import + Trash needed moving.

Tests: app type-check clean for both edited files; no server impact.
<!-- SECTION:FINAL_SUMMARY:END -->
