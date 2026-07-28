---
id: NOT-70
title: Effect error channel enforcement
status: ready-for-agent
assignee: []
created_date: '2026-07-28 14:52'
updated_date: '2026-07-28 15:19'
labels:
  - enhancement
dependencies:
  - NOT-63
ordinal: 73000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add a custom lint rule or Effect runtime hook that flags any Effect where the error channel is not explicitly handled (no catchAll, catchTag, catchAllCause, or matchEffect). Directly addresses NOT-9 (Zustand stores swallow errors silently). Catches agent-introduced crash paths at build time rather than in production.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Rule detects Effects whose error type is never narrowed or handled
- [ ] #2 Existing violations in the codebase are fixed (not suppressed)
- [ ] #3 Rule runs as part of the lint/CI pipeline
- [ ] #4 Zustand store error swallowing (NOT-9) is resolved
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add a biome lint rule or ast-grep rule to detect Effects whose error channel is never handled\n2. Fix existing violations in Zustand stores (NOT-9)\n3. Wire into CI pipeline
<!-- SECTION:PLAN:END -->
