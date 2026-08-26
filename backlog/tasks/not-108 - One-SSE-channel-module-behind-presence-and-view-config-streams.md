---
id: NOT-108
title: One SSE channel module behind presence and view-config streams
status: ready-for-agent
assignee: []
created_date: '2026-08-26 11:11'
labels:
  - enhancement
dependencies: []
priority: medium
ordinal: 103000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Two server modules open server-sent-event streams and duplicate the same mechanics: query-parameter authentication (EventSource cannot set headers), a permission check, an async stream with a subscriber set, a keepalive interval, the SSE header block, and a cause handler. The view-config module says outright in its opening comment that its pattern mirrors presence.

They have already drifted: the keepalive intervals differ between the two. And the finalizer defect documented in a comment on the presence route exists in both files, described in only one.

Target interface: a channel module taking an authorization step and a subscribe function and returning the response. Framing, keepalive, finalization, CORS and the ordering of the auth check all live behind it. The two ~200-line modules become two topic definitions of roughly 40 lines, holding only what actually differs between them.

Fix the finalizer defect once, in the channel, rather than twice.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A single channel module owns SSE framing, keepalive, finalization, CORS headers and auth ordering
- [ ] #2 Presence and view-config are expressed as topic definitions over that module, holding only what differs
- [ ] #3 Both topics share one keepalive interval
- [ ] #4 The finalizer defect is fixed in the channel module and a test covers subscriber cleanup on disconnect
- [ ] #5 The live-sync and presence E2E specs pass unchanged
<!-- AC:END -->
