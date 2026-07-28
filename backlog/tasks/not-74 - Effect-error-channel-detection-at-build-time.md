---
id: NOT-74
title: Effect error channel detection at build-time
status: wontfix
assignee: []
created_date: '2026-07-28 15:57'
updated_date: '2026-07-28 19:32'
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

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
NOT-74 closed as wontfix. After analysis:
1. Shell script approach produced 160 false positives — every Effect.gen call is flagged because the error handling is on the outer withAuthWorkspace(...) wrapper, not the inner Effect.gen.
2. Effect type enforcement at build-time would require either a custom Biome rule (not supported in v2), an ast-grep rule (same false-positive problem), or TypeScript branded types on withAuthWorkspace (significant refactor, low payoff).
3. The existing code is well-structured: all server Effect.gen calls delegate errors to withAuthWorkspace (Effect.orDie) or a central catchAllCause in index.ts. No unresolved error channels remain.
4. NOT-70's Zustand store check already addresses the practical risk of silent failures.

Only a TypeScript type-level enforcement (e.g., requiring Effect<A, never, R> before passing to certain contexts) could catch this correctly, but that's a library-level pattern change, not a lint rule. Skipping.
<!-- SECTION:FINAL_SUMMARY:END -->
