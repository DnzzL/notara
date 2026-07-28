---
id: NOT-74
title: Effect error channel detection at build-time
status: ready-for-agent
assignee: []
created_date: '2026-07-28 15:57'
labels:
  - effect
  - static-analysis
dependencies: []
ordinal: 77000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
NOT-70 asked for a rule that detects Effect types with unhandled error channels at build time (catchAll, catchTag, catchAllCause, matchEffect). The current implementation only detects missing try/catch in Zustand stores — a useful but different concern. This task covers the original spec: write an ast-grep rule or TypeScript checker that flags Effect values where the error channel is never narrowed or handled. 27 server files reference Effect.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 AST-level rule detects Effect values with unhandled error channels
- [ ] #2 Existing violations are flagged or suppressed with explicit ignore comments
- [ ] #3 Rule runs in CI (lint job) and fails on new violations
<!-- AC:END -->
