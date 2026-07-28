---
id: NOT-63
title: 'CI pipeline: run unit + E2E + type-check on every push'
status: ready-for-agent
assignee: []
created_date: '2026-07-28 14:52'
updated_date: '2026-07-28 15:43'
labels:
  - enhancement
dependencies: []
ordinal: 66000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add a GitHub Actions workflow that runs bun test, playwright test, and tsc --noEmit on every push and PR to main. Merge must be blocked on failure. This is the foundational gate — without it, none of the other quality constraints have teeth.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 GitHub Actions workflow triggers on push and PR to main
- [x] #2 bun test runs across all packages and must pass
- [x] #3 playwright test runs and must pass (with web server started)
- [x] #4 tsc --noEmit type-checks the project and must pass
- [ ] #5 Merge to main is blocked on CI failure
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Create GitHub Actions CI workflow (.github/workflows/ci.yml) that runs on push/PR to main
2. Workflow steps: checkout, bun install, bun run --filter '*' test (unit tests across packages), tsc --noEmit type-check across all packages, playwright test (E2E)
3. Add branch protection documentation for merging
4. Set up pre-push hook using simple-git-hooks for local quick check
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
CI pipeline implementation:
- Created .github/workflows/ci.yml with type-check, unit-tests, e2e-tests, and merge-gate jobs
- Set up pre-push hook via simple-git-hooks to run typecheck + unit tests locally
- Created packages/app/src/vite-env.d.ts for Vite types
- Fixed tsconfig for app package (declaration: false to avoid TS2742)
- Fixed pre-existing test failures in schema.test.ts (added missing isFavorite, config, deletedAt, isDefault fields)
- Removed unused databases prop from InlineCellEditor calls

CI workflow runs:
1. type-check: tsc --noEmit for all packages with tsconfig
2. unit-tests: bun test for server, app, electron; vitest for shared
3. e2e-tests: playwright test with chromium
4. merge-gate: blocks merge if any job fails

Code review fix: AC#3 (playwright with web server started) was actually already satisfied by playwright.config.ts's webServer config — marking complete.
<!-- SECTION:NOTES:END -->
