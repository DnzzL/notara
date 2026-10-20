---
id: NOT-81
title: 'Peer page-meta changes (title, icon, cover) never reach other viewers'
status: done
assignee:
  - '@claude'
created_date: '2026-08-04 14:58'
updated_date: '2026-08-04 16:00'
labels:
  - bug
dependencies: []
priority: medium
ordinal: 69000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
updatePage broadcasts page.metaUpdated (rpc-handlers.ts) and presenceConnection.ts listens for it, but the handler only forwards to an optional onPageMetaUpdated callback and mirrors nothing into the page store. BlockEditor's startPresence call passes only onBlockUpdated, so the event is received and dropped: a peer renaming a page (or changing its icon/cover) leaves other viewers on the stale header until they reload. Failing spec: e2e/multiuser-live-sync.spec.ts ('a page rename by a peer updates the other viewer's header'). Related: NOT-78.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A page rename by one user updates the header for other viewers of that page without a reload
- [x] #2 The failing spec in e2e/multiuser-live-sync.spec.ts passes
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
page.metaUpdated is now mirrored into the page store in presenceConnection.ts, the way the block events already were. Previously the event arrived and was only forwarded to an optional onPageMetaUpdated callback that BlockEditor never passed, so every other viewer sat on a stale title, icon, and cover until reload. The SSE stream is per-page, so the event applies to the connection's pageId.

Tests: 'a page rename by a peer updates the other viewer's header' in e2e/multiuser-live-sync.spec.ts now passes.
<!-- SECTION:FINAL_SUMMARY:END -->
