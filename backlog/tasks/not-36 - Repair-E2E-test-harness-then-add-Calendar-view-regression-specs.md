---
id: NOT-36
title: 'Repair E2E test harness, then add Calendar view regression specs'
status: needs-triage
assignee: []
created_date: '2026-06-18 20:30'
labels:
  - bug
dependencies: []
priority: medium
ordinal: 41000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The Playwright E2E suite is stale and effectively broken: e2e/board-drag-drop.spec.ts selects .board-card/.board-column/.table-view (removed in the Tailwind migration NOT-25) and navigates to /?page=ID with no workspace slug and no auth/login fixture, so it cannot pass against the current app. There is also no frontend unit-test harness in packages/app (0 tests, no vitest/testing-library). Repair the harness (fix selectors, add an auth storageState fixture + seeded DB or workspace-slug-aware navigation), then add e2e/database-views.spec.ts covering: (1) regression — switching a database from Board to Calendar stays on Calendar (does not revert to Board); (2) month navigation prev/next; (3) +-on-a-day creates a record dated to that day.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Existing e2e specs pass against the current Tailwind/workspace-routed app (or are rewritten)
- [ ] #2 An auth/seed fixture exists so E2E can reach a database without manual DB prep
- [ ] #3 Calendar specs cover board→calendar persistence, month nav, and +-on-day record creation
<!-- AC:END -->
