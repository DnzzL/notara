---
id: NOT-86
title: >-
  Local quality gates silently no-op: bunx biome resolves to the wrong npm
  package
status: needs-triage
assignee: []
created_date: '2026-08-04 18:05'
labels:
  - bug
dependencies: []
priority: high
ordinal: 81000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The pre-commit and pre-push hooks (and package.json's pre-merge script) call 'bunx biome ...'. In a worktree, bunx resolves that bare name to an unrelated npm package published as 'biome' (version 0.3.3), which exits 0 without checking anything — so the formatting/lint gate passes vacuously. Verified: 'bunx biome --version' prints 0.3.3, while 'bunx @biomejs/biome --version' prints 2.5.7 and immediately reports 12 errors on files 'bunx biome' declared clean. Consequence: unformatted code can be committed and pushed while both hooks report success. Discovered while rebasing the multiuser E2E branch (NOT-78).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Hooks and scripts invoke @biomejs/biome (or the local node_modules binary) rather than the bare name 'biome'
- [ ] #2 A deliberately misformatted file makes the pre-commit hook fail
<!-- AC:END -->
