---
id: NOT-46
title: 'Spike: evaluate a composable policy layer over the Zanzibar checks'
status: wontfix
assignee: []
created_date: '2026-07-09 16:16'
updated_date: '2026-07-21 13:45'
labels:
  - enhancement
dependencies: []
ordinal: 49000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
INVESTIGATION / DECISION ONLY — not a build ticket; a 'wontfix' outcome is fully valid. Evaluate whether a composable policy layer (a la Barake, 'Building a Composable Policy System': Policy = Effect<void, Forbidden, R> with all/any/withPolicy) should sit over Notara's Zanzibar-style checks in permissions.ts (checkPage/Block/Database/Record/Field/View + requireWorkspaceOwner). Those checks are already policy-shaped Effects and the resolver already centralizes the LOGIC; the only thing a policy layer tidies is the ATTACHMENT site — the repeated .pipe(Effect.orDie) across rpc-handlers.ts. Weigh that against CLAUDE.md 2 ('sans complexifier le code avec des checks dans tous les sens') and 5 (no scattered tier/plan checks). Deliverable is a short recommendation, not code.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A written recommendation (adopt / partial / decline) with the concrete trade-off for THIS codebase, referencing at least 3 real call sites in rpc-handlers.ts
- [ ] #2 It explicitly addresses composition need (is there real all/any logic today, e.g. workspace-owner OR page-editor?) vs pure attachment-site tidying
- [ ] #3 If adopt/partial, it names the minimal seam (a single withPolicy combinator, no new permission-string DSL unless justified) and confirms it does not reintroduce scattered tier/plan checks banned by CLAUDE.md 5
- [ ] #4 Outcome recorded (ADR note or decision comment); no production code required to close this spike
<!-- AC:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: @triage
created: 2026-07-21 13:45
---
Closed as wontfix. Investigation complete — the current permission architecture (centralized `permissions.ts`, clean `yield*` call sites, `checkVia` factory) is the right level of simplicity for this codebase. No composition need exists, the attachment site is already clean, and adding a policy layer would violate CLAUDE.md rule 2 (don't complexify with scattered checks). Decision recorded in `.out-of-scope/composable-policy-layer.md`.
---
<!-- COMMENTS:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Closed as wontfix. Investigation: current permissions.ts design is already clean and minimal — centralized checks, simple yield* call sites, no composition need exists in rpc-handlers.ts. A policy layer would add indirection without benefit, violating CLAUDE.md rule 2. Decision recorded in .out-of-scope/composable-policy-layer.md.
<!-- SECTION:FINAL_SUMMARY:END -->
