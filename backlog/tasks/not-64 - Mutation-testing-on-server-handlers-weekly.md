---
id: NOT-64
title: Mutation testing on server handlers (weekly)
status: ready-for-agent
assignee: []
created_date: '2026-07-28 14:52'
updated_date: '2026-07-28 14:53'
labels:
  - enhancement
dependencies:
  - NOT-68
ordinal: 67000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add StrykerJS to mutate server handler code on a weekly cron schedule. If a mutation survives (no test fails), the report flags it — verifying that tests actually test, not just cover lines. Runs on a schedule to avoid slowing down per-push CI.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 StrykerJS configured for @notara/server package
- [ ] #2 Weekly GitHub Actions cron triggers mutation run
- [ ] #3 Surviving mutations are reported as a CI artifact
- [ ] #4 Report is human-readable (identifies which handler/method has weak tests)
<!-- AC:END -->
