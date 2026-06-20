---
id: NOT-36
title: 'Repair E2E test harness, then add Calendar view regression specs'
status: done
assignee: []
created_date: '2026-06-18 20:30'
updated_date: '2026-06-19 17:15'
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
- [x] #1 Existing e2e specs pass against the current Tailwind/workspace-routed app (or are rewritten)
- [x] #2 An auth/seed fixture exists so E2E can reach a database without manual DB prep
- [x] #3 Calendar specs cover board→calendar persistence, month nav, and +-on-day record creation
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Triage: Repair E2E test harness + Calendar regression specs

**Category:** Bug / Infrastructure
**Priority:** Medium — confirmed (blocking testing infra, no production impact)
**Product area:** Testing / CI

### Issue Summary
The Playwright E2E suite is broken after the Tailwind CSS migration (NOT-25). Selectors reference removed classes (.board-card, .board-column, .table-view), and navigation lacks workspace slug + auth fixture, so tests can't reach a database. The harness needs a full repair before Calendar regression specs can be added.

### Key Details
- **Impact:** Blocks all E2E testing — no CI safety net for database/calendar features
- **Workaround:** Manual testing only
- **Related tasks:** NOT-25 (Tailwind migration — root cause), NOT-37 (Calendar — downstream consumer)
- **Known issue:** No duplicates found

### Routing Recommendation
**Route to:** Engineering
**Why:** Requires code-level fixes to selectors, navigation patterns, and test fixtures

### Assessment
The Medium priority is appropriate. This is a genuine infrastructure blocker — E2E tests are completely non-functional. Fixing the harness unlocks safe iteration on the Calendar view (and any future frontend work). The Calendar regression specs (board→calendar persistence, month nav, +-on-day) are well-scoped downstream specs that should be added after the harness is solid.

### Recommended Action
→ Move to **ready for agent** when someone picks it up. No human decision needed — the work is defined and scoped.
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Repair E2E test harness and add Calendar view regression specs.

What changed:
- Rewrote all 3 existing E2E specs (basic.spec.ts, block-types.spec.ts, board-drag-drop.spec.ts) with current selectors matching the Tailwind-migrated UI (post NOT-25) — using data attributes ([data-sidebar], [data-new-page], [data-search-trigger]), role attributes ([role=tab]), name attributes (name=page-title), and text-based locators instead of removed CSS class names (.board-card, .table-view, .slash-menu).
- Added e2e/auth.setup.ts — signs up a fresh test user via the UI, saves Playwright storageState so downstream tests start authenticated. Handles both verified and unverified email flows.
- Updated playwright.config.ts — added auth setup project with storageState dependency for test projects.
- Added e2e/database-views.spec.ts — 3 Calendar regression specs: (CR-1) Board-to-Calendar switching persistence, (CR-2) month navigation prev/next buttons, (CR-3) plus-on-day creates record dialog and renders the created record.
- Added playwright/.auth/ to .gitignore.

Tests still require a running server (handled by the webServer config). Auth setup creates a fresh user each run via the signup flow.
<!-- SECTION:FINAL_SUMMARY:END -->
