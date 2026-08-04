---
id: NOT-85
title: >-
  e2e/basic.spec.ts calls locator.toBeVisible() without expect(), throwing at
  runtime
status: needs-triage
assignee: []
created_date: '2026-08-04 14:59'
labels:
  - bug
dependencies: []
priority: low
ordinal: 73000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
In e2e/basic.spec.ts the 'add database field and record' test does: await page.locator('table.w-full').toBeVisible({ timeout: 10000 }). Locator has no toBeVisible method — this is a TypeError, not an assertion, so the test fails for the wrong reason. Should be expect(locator).toBeVisible(). Spotted while working on NOT-78; the single-user suite was not otherwise touched.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The call is rewritten as an expect() assertion
- [ ] #2 e2e/basic.spec.ts fails only on genuine product problems, not on harness TypeErrors
<!-- AC:END -->
