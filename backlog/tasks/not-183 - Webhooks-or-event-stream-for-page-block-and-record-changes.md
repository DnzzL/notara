---
id: NOT-183
title: Webhooks or event stream for page, block and record changes
status: ready-for-agent
assignee: []
created_date: '2026-11-11T13:21:00Z'
updated_date: '2026-11-11T21:57:00Z'
labels:
  - enhancement
milestone: m-5
dependencies:
  - NOT-122
priority: high
ordinal: 156000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Why: agents poll today; they should react. Events are generated from the operation table (NOT-122), not per handler, so every REST/MCP/RPC mutation emits one for free. Needs a human choice: webhooks vs SSE (or both), plus an ADR.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Events for page, block and record create/update/delete are derived from the operation table, with no per-handler emit calls
- [ ] #2 A consumer receives an event after a change made over REST, tested
- [ ] #3 Events respect the subscriber's permissions: no event for content the key cannot read
- [ ] #4 Reuses the existing SSE channel module if SSE is chosen
- [ ] #5 An ADR records SSE over the existing SSE channel module, and the rejected option (webhooks: no outbound calls)
<!-- AC:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: @assistant
created: 2026-11-11T21:57:00Z

---

Decision (approved): SSE event stream over the existing SSE channel module, not webhooks (no outbound calls). ADR required. SSRF AC dropped (no outbound calls).

---
<!-- COMMENTS:END -->
