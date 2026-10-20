---
id: NOT-19
title: Fix last-viewed page and workspace persistence across sessions
status: done
assignee: []
created_date: '2026-06-16 16:05'
updated_date: '2026-06-16 16:45'
labels:
  - frontend
  - persistence
  - ux
  - bug
dependencies: []
priority: medium
ordinal: 19000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When navigating back to the app after closing/reloading, the last viewed page and workspace are not reliably restored. The issues are: (1) 'notara:recentPages' in localStorage is workspace-agnostic — switching workspaces can land you on a page from a different workspace. (2) There is no per-workspace 'last viewed page' key, so the workspace-slug page only falls back to recents or the first root page. (3) The workspace slug itself isn't remembered across sessions — the redirect in the root route just takes the first workspace from getMyWorkspaces. (4) The selectPage logic pushes the page ID to URL but restore on popstate relies on the URL param alone, which isn't persisted.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Add per-workspace last viewed page storage (e.g., notara:lastPage:{workspaceId}) instead of the flat recentPages list
- [x] #2 Persist the last-active workspace slug to localStorage so the root route redirects there first
- [x] #3 Ensure the URL page param is synced to session restore (not just pushState)
- [x] #4 Test the full flow: reload, close/open tab, switch workspaces and come back
<!-- AC:END -->
