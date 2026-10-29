---
id: NOT-68
title: 'Coverage floor: prevent test coverage backsliding'
status: ready-for-agent
assignee: []
created_date: '2026-07-28 14:52'
updated_date: '2026-07-28 15:17'
labels:
  - enhancement
dependencies:
  - NOT-63
ordinal: 71000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add coverage measurement to CI for each package (bun test --coverage). Capture the current coverage baseline. CI fails if any package drops below its baseline. Baseline can be raised manually when coverage improves.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Coverage reported per package in CI output
- [x] #2 Current coverage baseline captured and stored in config
- [ ] #3 CI fails if any package coverage drops below baseline
- [x] #4 Baseline is configurable (not hardcoded) so it can be raised over time
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add bun test --coverage to the CI unit-tests job\n2. Capture current coverage baseline for each package\n3. Store baseline in a config file\n4. Add coverage check step that fails if below baseline
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Coverage floor implementation:
- Created .github/coverage-thresholds.yml with baseline thresholds per package
- Created scripts/check-coverage.sh to run tests with --coverage and check against thresholds
- Installed @vitest/coverage-v8@3 for shared package coverage
- Added coverage checks to CI unit-tests job
- Thresholds will need to be raised manually as coverage improves (AC #4)

Current baselines: @notara/server=40%, @notara/app=15%, @notara/shared=35%, @notara/electron=80%
<!-- SECTION:NOTES:END -->
