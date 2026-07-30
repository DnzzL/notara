---
id: NOT-76
title: Bundle-size check silently skips hashed app bundles
status: needs-triage
assignee: []
created_date: '2026-07-30 12:36'
labels:
  - bug
dependencies: []
priority: medium
ordinal: 79000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
scripts/check-bundle-size.sh stores baselines keyed by Vite content-hashed filenames (e.g. index-mdfZgkvm.js). Vite regenerates a new hash on every build, so the baseline entries never match: the script prints 'MISSING (not built?)' for the app JS and CSS bundles and still exits 0, reporting '2 passed, 0 failed'. The two files the check exists to guard are the two it skips, so it currently gives false confidence. Baselines should be matched on a hash-independent pattern (e.g. assets/index-*.js) or on total dist size.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Bundle-size check matches app JS/CSS bundles regardless of Vite content hash
- [ ] #2 A real size regression above the 10% threshold makes the script exit non-zero
- [ ] #3 No baseline entry is reported as MISSING on a clean build
<!-- AC:END -->
