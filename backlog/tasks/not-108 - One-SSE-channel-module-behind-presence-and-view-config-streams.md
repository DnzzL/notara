---
id: NOT-108
title: One SSE channel module behind presence and view-config streams
status: done
assignee:
  - '@thomas'
created_date: '2026-08-26 11:11'
updated_date: '2026-08-26 14:30'
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
- [x] #1 A single channel module owns SSE framing, keepalive, finalization, CORS headers and auth ordering
- [x] #2 Presence and view-config are expressed as topic definitions over that module, holding only what differs
- [x] #3 Both topics share one keepalive interval
- [ ] #4 The finalizer defect is fixed in the channel module and a test covers subscriber cleanup on disconnect
- [x] #5 The live-sync and presence E2E specs pass unchanged
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
The two stream files went from 172 + 220 lines to 123 + 176, with 137 shared. Presence keeps its heartbeat and leave handlers, which is why it does not shrink further.

Drift the two copies had already accumulated, now impossible: keepalive was 20s in presence and 30s in view-config (one value now, 20s, because proxies commonly idle out at 30 and an extra comment frame costs nothing); CORS origin was resolved as BASE_URL ?? '*' in both, ignoring the TRUSTED_ORIGINS fallback that middleware.ts already implemented for every other route.

That last point turned up a wrong claim in NOT-121: middleware.ts _allowedOrigin was described there as computed and unused. corsHeaders consumes it. It has been renamed to allowedOrigin, exported, and is now the single origin resolution for the SSE channel too. Recorded on NOT-121.

AC 4 (the finalizer fix) is deliberately NOT checked. The defect is real and now sits in one place instead of two, but it is not fixed: on Bun the stream finalizer does not run on client disconnect, and neither a closed response nor a failed keepalive write surfaces it. Fixing it needs a way to detect disconnection that this platform does not currently offer, which is a different piece of work from consolidating the pattern. The channel documents it where a fix would go. Presence remains correct regardless — it learns about departures from an explicit leave endpoint with a TTL sweep behind it, and the E2E covers both the announced and the silent case.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
One SSE channel behind presence and view-config.

Both streams carried their own copy of the same mechanics — query-param authorization, a permission check, an async stream over a subscriber set, a keepalive interval, the SSE header block, a cause handler. view-config's opening comment said so outright: 'pattern mirrors presence'.

They had already drifted in the details nobody re-reads: keepalive was 20 seconds in one and 30 in the other, both resolved the CORS origin with a narrower rule than the rest of the server, and the finalizer defect documented in a comment on one existed identically in the other while being described in only one place.

Changes:
- sse-channel.ts: framing, keepalive, finalization, CORS, authorization ordering and refusal-to-response behind one interface. A topic supplies only what differs — how to authorize, what to send first, how to subscribe.
- presence/routes.ts and view-config-stream.ts become topic definitions; 392 lines of stream code become 299 plus 137 shared.
- middleware.ts: _allowedOrigin renamed to allowedOrigin and exported, so the SSE channel and the CORS header block resolve the origin the same way. It was never unused, contrary to NOT-121's description — corrected there.

Not fixed, and deliberately left visible: the Bun finalizer defect. It now sits in one place with a comment where the fix belongs, rather than in two with a comment in one. Presence is unaffected in practice — departures come from an explicit leave endpoint with a TTL sweep behind it.

Tests: 202 unit pass / 0 fail, type-check and biome clean, 16 E2E across presence, locks and live-sync passed.
<!-- SECTION:FINAL_SUMMARY:END -->
