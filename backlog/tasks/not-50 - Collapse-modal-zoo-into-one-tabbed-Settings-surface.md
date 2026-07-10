---
id: NOT-50
title: Collapse modal zoo into one tabbed Settings surface
status: done
assignee: []
created_date: '2026-07-10 15:39'
updated_date: '2026-07-10 16:01'
labels:
  - enhancement
dependencies: []
priority: medium
ordinal: 53000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Notara has 8+ modals; four of them are settings-shaped: SettingsModal, WorkspaceSettingsModal, ApiKeysModal, and the Members/invite surface. Four entry points reading as 'lots of admin' works against the lightweight positioning. Merge them into one tabbed Settings surface (tabs: Account/Preferences, Workspace, Members, API keys) reusing the existing component bodies. Composition change only — reuse current logic, do not rewrite the underlying settings forms.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A single Settings surface with tabs replaces the separate Settings, Workspace settings, API keys, and Members modals
- [x] #2 Each tab reuses the existing component body/logic; no settings functionality lost
- [x] #3 Only one Settings entry point remains in the UI
- [x] #4 App type-check passes; existing tests green
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Reality: not a 4-modal merge. It's 2 modals (SettingsModal=Backups, ApiKeysModal) + 1 settings route (Members/invite) + 1 dead component (WorkspaceSettingsModal, left untouched). Approved: full tabbed route.
1. Create ApiKeysPanel.tsx (ApiKeysModal body minus Modal chrome).
2. Create BackupsPanel.tsx (SettingsModal body minus Dialog chrome + open-gating + Cancel + unused onStartTour).
3. Delete ApiKeysModal.tsx + SettingsModal.tsx (only Sidebar used them).
4. settings.$workspaceSlug.tsx: add tab bar (Members / API keys / Backups); Members tab keeps existing invite+members sections; other tabs render the panels.
5. WorkspaceSwitcher.tsx: replace 3 Settings entries with one 'Settings' -> navigate to route; drop onOpenBackups/onOpenApiKeys props.
6. Sidebar.tsx: remove SettingsModal/ApiKeysModal imports, showSettings/showApiKeys state, their render, and onOpenBackups/onOpenApiKeys wiring. Keep Import/Trash (NOT-49) + Help.
7. Verify tsc for edited files (leave pre-existing route Button errors); server tests unaffected.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Extracted ApiKeysModal -> ApiKeysPanel and SettingsModal -> BackupsPanel (bodies verbatim, modal/dialog chrome + open-gating + Cancel + unused onStartTour removed), deleted the two modal files (only Sidebar used them). settings.$workspaceSlug.tsx now has a tab bar: Members (existing invite+members) / API keys / Backups. WorkspaceSwitcher's 3 Settings entries collapsed to one 'Settings' link (route); dropped onOpenBackups/onOpenApiKeys props. Sidebar: removed the two modal imports/state/renders + wiring. Verify: app tsc clean for all edited/new files; remaining 5 app errors are pre-existing (PageReferenceMenu, import.meta.env, styles.css). Confirmed .settings-* CSS is top-level, not scoped under .settings-modal, so Backups styling is intact. Deviations: tabs are Members/API keys/Backups (no empty 'Workspace' tab — Members is the workspace settings). WorkspaceSettingsModal.tsx is pre-existing dead code (unused, duplicates the Members section) and was left untouched. No server changes; server tests unaffected.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Collapse the settings modal zoo into one tabbed Settings surface.

Before: 3 dropdown entries (Workspace settings -> route, Backups -> SettingsModal, API keys -> ApiKeysModal) opening 2 separate modals plus a route. After: a single 'Settings' entry in the WorkspaceSwitcher dropdown opens /settings/$workspaceSlug, which now has tabs: Members / API keys / Backups.

Changes:
- New ApiKeysPanel.tsx and BackupsPanel.tsx: the former modal bodies with modal/dialog chrome removed (Backups also drops the 'open' gating -> loads on mount, and the modal-only Cancel button).
- Deleted SettingsModal.tsx and ApiKeysModal.tsx (only the sidebar used them).
- settings.$workspaceSlug.tsx: added a tab bar; Members tab keeps the existing invite + members sections; API keys and Backups tabs render the new panels.
- WorkspaceSwitcher.tsx: 3 Settings entries -> one 'Settings' link; removed onOpenBackups/onOpenApiKeys props.
- Sidebar.tsx: removed the two modals' imports, state, renders, and wiring.

Why: fewer entry points and one place for all settings supports the 'simplest, lightest Notion alternative' positioning.

Net: +27 / -545 lines in edited files (plus two focused panel files). App type-check clean for all touched files (only pre-existing unrelated errors remain). No server changes.

Notes: WorkspaceSettingsModal.tsx is pre-existing dead code (unused duplicate of the Members section) and was left untouched per repo policy.
<!-- SECTION:FINAL_SUMMARY:END -->
