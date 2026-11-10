---
id: NOT-136
title: CI never builds packages/app
status: done
assignee: []
created_date: 2026-08-29 17:33
updated_date: '2026-11-10T17:06:00Z'
labels:
  - bug
dependencies: []
priority: medium
ordinal: 131000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
ci.yml runs install, shared build, typecheck, tests and e2e — but never 'bun run --filter @notara/app build'. The only place vite build runs is the Docker image build at release time. A build-only breakage (a bad vite plugin option, a missing patch step, an unresolvable import) therefore reaches release before anything reports it. Found while fixing NOT-135, where the local build failed for three unrelated pre-existing reasons and there was no green reference to compare against.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 CI builds packages/app on every push
- [x] #2 App build passes from a clean checkout with CI's command sequence
- [x] #3 CI jobs pinned to ubuntu-24.04 (Playwright cannot install chromium on ubuntu26.04)
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
CI job 'check' now runs 'bun run --filter @notara/app build' right after the shared build, so a Vite-only breakage fails the PR instead of reaching the release Docker build.

Changes:
- .github/workflows/ci.yml: one step 'build app'; no new deps.

Tests:
- Local clean sequence: install --frozen-lockfile --ignore-scripts, apply-patches, shared build, app build → exit 0 (only existing chunk-size/dynamic-import warnings). No pre-existing failure to fix.
<!-- SECTION:FINAL_SUMMARY:END -->
