---
id: NOT-80
title: 'Presence avatars never disappear: no leave event and no TTL-driven refresh'
status: done
assignee:
  - '@claude'
created_date: '2026-08-04 14:58'
updated_date: '2026-08-04 16:00'
labels:
  - bug
dependencies: []
priority: high
ordinal: 68000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
PresenceService.sweep() evicted entries past the presence TTL but emitted nothing, heartbeat only emitted on a new user or a focus change, and closing the SSE stream sent no leave notification. Consequence: once a peer was shown on a page, the avatar stayed there indefinitely for everyone else — after the peer navigated away, closed the tab, or dropped off the network. Proven by E2E: the avatar was still present 20s after the peer left and 90s after a hard disconnect. Correction to the original report: the sweep IS scheduled, every 5s from presence/index.ts:10 — the defect was that it never told anyone.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 When a peer leaves a page, remaining viewers stop showing that peer within a few seconds
- [x] #2 When a peer disconnects without warning, remaining viewers drop the avatar once the presence TTL lapses
- [x] #3 Both failing specs in e2e/multiuser-presence.spec.ts pass
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Presence departures now reach the users who stayed.

Server:
- sweep() emits presence.changed for each page it evicted someone from, so a TTL lapse is actually observed by remaining viewers. Entries carry their (workspace, page) pair so a sweep can address the page.
- New leave(workspaceId, pageId, userId) drops a user and notifies the rest; a leave for someone not present is silent.
- New POST /api/presence/leave lets the client report a departure.

Client:
- stopPresence() and a pagehide handler announce the departure. sendLeave() silences the heartbeat timer first, otherwise a late heartbeat resurrects the user on the page peers just watched them leave. pagehide skips the announcement when event.persisted is set, so a back/forward-cache restore does not strand a returning user as invisible.

The SSE stream finalizer looked like the natural signal and was tried first, but it never runs on this platform — Bun's streaming response does not surface client disconnect, verified by instrumenting it. A note in presence/routes.ts records that so the next reader does not repeat the attempt.

Tests: three specs in e2e/multiuser-presence.spec.ts — in-app navigation (1.5s), tab close (asserted within 15s, so it fails if the announcement breaks rather than falling back on the TTL), and a peer that goes silent expiring by TTL (~33s, driven over the HTTP API with no browser so only the sweep can clear it). Four new PresenceService unit tests cover leave() and the sweep emission; 176 server tests pass.

Scope note: in-app page switches are client-side routing and announce instantly. A full-document navigation aborts the request no matter how it is sent (sendBeacon and fetch keepalive were both tried and both abort), so that case falls to the TTL — which is now proven to work.
<!-- SECTION:FINAL_SUMMARY:END -->
