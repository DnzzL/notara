---
id: NOT-171
title: 'Parity gate: every user-facing app action has an operationId'
status: ready-for-agent
assignee: []
created_date: '2026-11-10T17:05:00Z'
labels:
  - enhancement
milestone: m-0
dependencies: []
priority: high
ordinal: 143000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Depends on PR #33 (feat/agent-ready-ops: typed operation table behind REST, OpenAPI, MCP, CLI) landing first.
Why: agent-ready means every button is drivable (ArtCraft: 'drive every app from a CLI, a JSON control channel or an MCP server'). Today nothing stops a UI action shipping with no operation.
Agent brief: inventory user-facing app actions (RPC handlers / UI mutations) and map each to an operationId in the operation table; keep an explicit, reviewed allowlist for non-user actions (auth, presence, internal). Extends the existing openapi-parity / cli-parity tests.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A server test fails when a user-facing action has no operationId in the operation table
- [ ] #2 Any exclusion lives in one explicit allowlist with a reason per entry
- [ ] #3 Adding a new action without an operationId makes the test red (demonstrated once, then reverted)
- [ ] #4 Test runs in 'bun test packages/server/test' and CI
<!-- AC:END -->
