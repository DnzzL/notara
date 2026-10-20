---
id: NOT-64
title: Mutation testing on server handlers (weekly)
status: ready-for-agent
assignee: []
created_date: '2026-07-28 14:52'
updated_date: '2026-07-28 15:29'
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
- [x] #1 StrykerJS configured for @notara/server package
- [x] #2 Weekly GitHub Actions cron triggers mutation run
- [x] #3 Surviving mutations are reported as a CI artifact
- [x] #4 Report is human-readable (identifies which handler/method has weak tests)
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Install StrykerJS for the server package\n2. Configure stryker.conf.json with target files (handlers)\n3. Create weekly GitHub Actions cron workflow\n4. Configure report artifact upload
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
NOT-64 Mutation testing setup:
- Installed @stryker-mutator/core@9.6.1 and @stryker-mutator/typescript-checker@9.6.1 for server package
- Created stryker.config.json targeting src/handlers/*.ts (excludes test files and index.ts)
- Using bun as the test runner via command-runner
- Created .github/workflows/mutation-weekly.yml with:
  - Schedule: Monday 03:00 UTC
  - Generates HTML report artifact stored for 30 days
  - workflow_dispatch for manual triggering
  - continue-on-error: true so the report is always generated even if mutations survive
- thresholds: high=80, low=60, break=null (informational, not blocking)
<!-- SECTION:NOTES:END -->
