---
id: NOT-71
title: 'Fix e2e auth flow: storageState captures empty Better Auth cookies'
status: ready-for-agent
assignee: []
created_date: '2026-07-28 15:57'
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
- [ ] #1 Auth storage state contains valid session cookies after signup
- [ ] #2 Downstream e2e tests can reuse the stored session
- [ ] #3 Works in CI with webServer proxying auth to :3000
<!-- AC:END -->
