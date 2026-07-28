---
id: NOT-73
title: 'Performance regression testing: bundle-size, render-bench, and Lighthouse CI'
status: ready-for-agent
assignee: []
created_date: '2026-07-28 15:57'
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
- [ ] #1 Bundle-size check runs on PR and fails if any package grows >10%
- [ ] #2 Lighthouse CI audits key routes (/, /login, /workspaces) for performance + accessibility
- [ ] #3 Render-bench test for database table view with 100+ records
- [ ] #4 Performance gates are documented and thresholds are configurable
<!-- AC:END -->
