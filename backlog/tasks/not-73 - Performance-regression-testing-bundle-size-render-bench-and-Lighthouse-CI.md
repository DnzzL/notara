---
id: NOT-73
title: 'Performance regression testing: bundle-size, render-bench, and Lighthouse CI'
status: done
assignee: []
created_date: '2026-07-28 15:57'
updated_date: '2026-07-28 19:29'
labels:
  - performance
  - ci
dependencies: []
ordinal: 76000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The current CI gauntlet has no performance gates. An agent can add a 2MB dependency, an O(n²) render loop, or a blocking main-thread operation without any check catching it. Add: (1) bundle-size check per package using bundlewatch or custom script, (2) Lighthouse CI for Core Web Vitals, (3) render-bench for component-level perf regression (e.g. React Profiler-based). Runs on PR, fails on regression above threshold.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Bundle-size check runs on PR and fails if any package grows >10%
- [x] #2 Lighthouse CI audits key routes (/, /login, /workspaces) for performance + accessibility
- [x] #3 Render-bench test for database table view with 100+ records
- [x] #4 Performance gates are documented and thresholds are configurable
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added 3 performance regression gates to CI pipeline:

1. Bundle-size check (scripts/check-bundle-size.sh)
   - Builds app + shared, compares against .github/bundle-sizes.json baseline
   - Fails on >10% growth per tracked file (configurable threshold)
   - Tracks: app JS (2.48 MB), CSS (88 KB), HTML, shared dist (117 B)

2. Lighthouse CI (.lighthouserc.json)
   - Audits /, /login, /workspaces for perf, a11y, best-practices, SEO
   - Warning thresholds: perf >=0.6, a11y >=0.8, best-practices >=0.8, SEO >=0.8
   - Resource budgets: total <3 MB, script <1 MB, stylesheet <128 KB
   - Reports uploaded as CI artifacts (30-day retention)

3. Render-bench (e2e/performance-regression.spec.ts)
   - Playwright E2E tests measuring rendering times
   - Sidebar: <2s (actual: 993ms)
   - Block editor load: <3s (actual: 2.2s)
   - Database table render: <5s (actual: 3.0s)

All gates documented in CONTRIBUTING.md. Thresholds are configurable via
.bundle-sizes.json, .lighthorserc.json, and inline expect() values.
CI workflow (ci.yml) updated with bundle-size, performance, and lighthouse jobs.
<!-- SECTION:FINAL_SUMMARY:END -->
