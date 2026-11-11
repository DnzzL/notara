---
id: NOT-183
title: Webhooks or event stream for page, block and record changes
status: ready-for-human
assignee: []
created_date: '2026-11-11T13:21:00Z'
labels:
  - enhancement
milestone: m-5
dependencies: []
priority: high
ordinal: 156000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Why: agents poll today; they should react. Events are generated from the operation table (NOT-122), not per handler, so every REST/MCP/RPC mutation emits one for free. Needs a human choice: webhooks vs SSE (or both), plus an ADR.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 An ADR picks webhooks vs SSE and records the rejected option
- [ ] #2 Events for page, block and record create/update/delete are derived from the operation table, with no per-handler emit calls
- [ ] #3 A consumer receives an event after a change made over REST, tested
- [ ] #4 Events respect the subscriber's permissions: no event for content the key cannot read
<!-- AC:END -->
