---
id: NOT-71
title: 'Fix e2e auth flow: storageState captures empty Better Auth cookies'
status: done
assignee: []
created_date: '2026-07-28 15:57'
updated_date: '2026-07-28 16:26'
labels:
  - e2e
  - auth
dependencies: []
ordinal: 74000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The Playwright auth.setup.ts signs up a user successfully but page.context().storageState() captures an empty state (0 cookies, 0 origins). Downstream tests can't use the authenticated session. Likely cause: Better Auth httpOnly cookies are set on port 3000 but Playwright only captures port 5173 cookies, or SameSite policy prevents cross-port cookie capture.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Auth storage state contains valid session cookies after signup
- [x] #2 Downstream e2e tests can reuse the stored session
- [x] #3 Works in CI with webServer proxying auth to :3000
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Fixed e2e auth storageState and captured visual regression baselines.

auth.setup.ts:
- Fixed input selectors (name= → type=) to match refactored login form
- Fixed redirect assumption (app now serves public landing page, no / → /login redirect)
- Dismissed cookie consent banner (accept analytics cookies)
- Dismissed onboarding tour via localStorage
- Added workspace auto-creation with timestamp-unique slug
- Added session cookie assertion before saving storageState

visual-regression.spec.ts:
- Template picker flow ([data-new-page] → 'Blank page')
- Page title edit mode (h1 click → input fill)
- Empty page first-block creation
- Overlay bypass via page.evaluate()
- Semantic selectors (getByRole, getByText) over CSS classes
- Screenshot stabilisation (caret-color + animations:disabled)

All 4 baselines (block-editor, sidebar-pages, database-table-view, database-board-view) pass as regression checks.
<!-- SECTION:FINAL_SUMMARY:END -->
