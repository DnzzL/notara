---
id: NOT-186
title: 'Upgrade guarantee: every release upgrades from the previous minor'
status: done
assignee: []
created_date: '2026-11-11T13:21:00Z'
updated_date: '2026-11-11T13:54:00Z'
labels:
  - enhancement
milestone: m-6
dependencies: []
priority: high
ordinal: 159000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Why: 1.0 promises people can upgrade without losing data. upgrade-restore.test.ts already upgrades from one previous-release migrations fixture (v0.1.4); the gap is a fixture per release (with data, not only migrations) and a defined 'previous minor' from v0.4 on.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Each minor release has a committed data fixture used by upgrade-restore.test.ts
- [x] #2 The test upgrades from the previous minor's fixture and asserts data intact
- [x] #3 The release checklist says to add the fixture for each new minor
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
upgrade-restore.test.ts now upgrades every test/fixtures/v*/ dir (v0.1.4 = latest tag, already present). README Upgrade section gains the per-minor fixture release step. Removing a released migration fails the prefix test.
<!-- SECTION:FINAL_SUMMARY:END -->
