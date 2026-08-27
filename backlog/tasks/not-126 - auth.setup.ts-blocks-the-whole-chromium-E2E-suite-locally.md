---
id: NOT-126
title: auth.setup.ts blocks the whole chromium E2E suite locally
status: ready-for-agent
assignee: []
created_date: '2026-08-27 08:03'
labels:
  - bug
dependencies: []
priority: medium
ordinal: 121000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Every spec in the chromium Playwright project depends on the setup project, and the setup times out clicking 'Create an account' on /login. Playwright reports the element resolved but never became 'visible, enabled and stable' — so it is present and something is sitting over it or moving it, most likely the cookie consent banner whose dismissal at the top of the setup is wrapped in a try that swallows its own failure.

Consequence: editor-enter, block-types, database-crud, database-views, board-drag-drop, popover-positioning and visual-regression cannot be run on a developer machine at all. The multiuser and rest projects are unaffected, because they sign up their own users over HTTP rather than through the UI.

This is worth more than its Medium priority: CI does not run Playwright either (ci.yml runs lint, effect-error-channels, both type-checks and unit tests), so a spec in the chromium project is currently run by nobody, anywhere. NOT-96 is the immediate case — its acceptance criterion asks for an e2e in editor-enter.spec.ts, which would be a test that never executes.

Ruled out while diagnosing: it is not stale local .data, and it is not a leftover account — the setup uses a timestamped email. An earlier failure with the same symptom turned out to be a broken node_modules ('Cannot find module unique-string' from Vite), fixed by a clean reinstall; this one survives that.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The setup completes on a developer machine with no manual steps
- [ ] #2 The consent banner no longer blocks it, and a failure to dismiss it fails loudly rather than being swallowed
- [ ] #3 One chromium spec is demonstrated running locally end to end
- [ ] #4 Decide whether CI should run the E2E suite at all — a project no one runs is worse than no project
<!-- AC:END -->
