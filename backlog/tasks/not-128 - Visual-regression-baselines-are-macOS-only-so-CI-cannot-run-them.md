---
id: NOT-128
title: 'Visual regression baselines are macOS-only, so CI cannot run them'
status: done
assignee: []
created_date: '2026-08-27 15:45'
updated_date: '2026-09-01 18:27'
labels:
  - enhancement
dependencies: []
priority: medium
ordinal: 123000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
e2e/visual-regression.spec.ts has four snapshots, all taken on macOS (-darwin suffix). CI runs on Linux, where text rasterises differently, so every one of them fails with 'A snapshot does not exist at ...-chromium-linux.png'.

They are excluded from the CI e2e job for now, because a permanently red job trains everyone to ignore it — which is the same failure mode NOT-126 just fixed, one level up.

The right answer is to make Linux canonical: CI is the authority on what the app looks like, and a developer machine is not. That means generating the four baselines on Linux (a CI run with --update-snapshots, or the Playwright Docker image locally), committing them, and deleting the darwin ones.

The consequence to accept with it: developers can no longer run visual regression locally against committed baselines, only against their own. Either they run it in Docker or they treat it as a CI-only check. Worth deciding which and writing it in CONTRIBUTING.md, because otherwise the next person regenerates the baselines on macOS and puts us back here.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The four baselines are Linux and committed
- [x] #2 The CI e2e job runs visual regression rather than excluding it
- [x] #3 CONTRIBUTING says how to regenerate a baseline, so nobody re-commits a macOS one
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Generated Linux baselines via a throwaway CI workflow_dispatch job (ubuntu-latest), committed *-linux.png, deleted *-darwin.png. Re-enabled visual regression in the e2e CI job. CONTRIBUTING.md documents the CI-only policy and the regeneration procedure. PR #21: https://github.com/DnzzL/notara/pull/21 — both check and e2e jobs (incl. visual regression) green.
<!-- SECTION:NOTES:END -->
