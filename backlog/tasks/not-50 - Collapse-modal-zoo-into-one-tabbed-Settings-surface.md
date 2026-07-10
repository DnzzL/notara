---
id: NOT-50
title: Collapse modal zoo into one tabbed Settings surface
status: ready-for-agent
assignee: []
created_date: '2026-07-10 15:39'
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
- [ ] #1 A single Settings surface with tabs replaces the separate Settings, Workspace settings, API keys, and Members modals
- [ ] #2 Each tab reuses the existing component body/logic; no settings functionality lost
- [ ] #3 Only one Settings entry point remains in the UI
- [ ] #4 App type-check passes; existing tests green
<!-- AC:END -->
