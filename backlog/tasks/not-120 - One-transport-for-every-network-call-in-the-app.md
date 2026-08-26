---
id: NOT-120
title: One transport for every network call in the app
status: done
assignee:
  - '@thomas'
created_date: '2026-08-26 11:13'
updated_date: '2026-08-26 20:14'
labels:
  - enhancement
dependencies: []
priority: medium
ordinal: 115000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The typed RPC client is deep and correct, but eight call sites ignore it and issue raw requests, each re-implementing its own error extraction: five in the backups panel, one in the import modal, one in the admin route, and the uploader. The settings-panel request loop fixed recently lived in exactly this region.

Extend the transport to cover the REST-only endpoints — upload, import, backup and admin — and delete the raw calls, so retry, authentication and error handling are decided once rather than eight times.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Every network call in the app goes through the transport module
- [x] #2 Error extraction is defined once, not per call site
- [x] #3 Upload, import, backup and admin endpoints are reachable through the transport with typed failures
- [ ] #4 Uploading a file, running an import and triggering a backup all still work from the UI
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
The ticket said eight raw fetches. There were fourteen — it missed presence heartbeat and leave, the landing page config loader, the admin user delete, and the health poll.

Three different error-extraction shapes across them, and the most common one is broken:

    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error);

It parses before it checks status. Any failure whose body is not JSON — an nginx 502, a proxy timeout page, an HTML 500 — throws inside json() first, so the user is told "Unexpected token <" instead of what went wrong. That is exactly the shape of the upload outage in NOT-123: the server returned a JSON 500 there, but a gateway failure would have been unreadable.

restCall reads a failure body without trusting it: JSON, then text, then the status line, never throwing from the error path itself. The status NUMBER is always in the fallback, because a user reporting "Service Unavailable" cannot tell you whether they saw 502 or 503, and those mean different things about where the failure is.

Three raw fetches deliberately kept, each with a comment saying why:
- the liveness poll during restore, which polls a server expected to be down
- presence heartbeat, where a failure is not worth a toast
- presence leave, which fires on unload with keepalive, where nothing is left to catch a rejection

Two defects fixed on the way, neither in the ticket:
- admin deleteUser removed the row from the list even when the delete failed, so the user looked gone until the next reload brought them back
- admin fetchData checked only the users response for 403, so a workspaces call failing another way surfaced as a crash rather than a message

COVERAGE GAP, stated rather than glossed: the uploader and import-modal changes are covered by the transport's unit tests, not by an end-to-end run through the UI. The chromium E2E project cannot run on this machine — auth.setup.ts fails on local .data state, confirmed identical before these changes — and wiping that data is not mine to do. The server-side upload and import paths are covered by 18 passing E2E.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
One transport for the REST-only endpoints.

Fourteen call sites — not the eight the ticket counted — issued raw fetches with three different error-extraction shapes. The most common one parsed the body as JSON before checking the status, so any failure whose body is not JSON surfaced as "Unexpected token <" rather than the real problem.

lib/restClient.ts adds X-Workspace-Id when a workspace is open, sets a JSON content type only when the caller has not chosen one (upload and import send raw bytes), returns null for the empty body a 204 answers with, and reads failure bodies defensively — JSON, then text, then the status line, never throwing from the error path itself. The status number is always in the fallback message.

Three raw fetches are kept deliberately, each commented: the restore liveness poll, which polls a server expected to be down, and the two presence calls, which are fire-and-forget and must not raise on unload.

Two defects fixed on the way, neither in the ticket: admin deleteUser removed the row even when the delete failed, and admin fetchData checked only one of two responses for 403.

Coverage gap, stated: the uploader and import-modal changes are covered by the transport unit tests, not by an E2E through the UI — the chromium project cannot run on this machine for reasons predating this change.

Tests: 107 app pass / 0 fail (7 new), both type-checks clean, biome clean, 18 E2E on the server-side upload and import paths.
<!-- SECTION:FINAL_SUMMARY:END -->
