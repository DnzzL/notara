---
id: NOT-103
title: Attachments become an ACL resource inheriting from their page (ADR-006)
status: done
assignee: []
created_date: '2026-08-26 11:10'
updated_date: '2026-08-26 11:52'
labels:
  - bug
dependencies: []
priority: high
ordinal: 98000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Serving an attachment currently asks for no credentials at all. Path traversal is blocked, access is not: every uploaded image and PDF is readable by anyone holding the ULID, including someone who was removed from the workspace or from the page.

Decision taken: an attachment is an ACL resource whose relation derives from the page that contains it. Losing access to the page loses access to the file. Record it as ADR-006 alongside the implementation, superseding the storage-only decisions in ADR-001.

Implement it now with the resolution path that already exists (the same resolve-relation-via-owning-page shape used for blocks, databases, records, fields and views). The composable Policy ticket will later absorb this check into declarative rewrite rules; nothing here should block on that, this is a security fix and ships first.

Note the user-visible consequence to state in the ADR: attachment URLs stop working outside an authenticated session, so anything relying on a bare image URL (exports, emails, embeds) has to be checked.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Requesting an attachment without a session is refused
- [x] #2 A workspace member with no access to the containing page cannot read that page's attachments
- [x] #3 A user who loses access to a page immediately loses access to its attachments, with no cache or grace window
- [x] #4 ADR-006 records the decision, its consequence for bare attachment URLs, and supersedes the relevant part of ADR-001
- [x] #5 A regression test covers the anonymous case and the member-without-page-access case
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented with the existing resolve-relation-via-owning-page path, as the ticket specified, so it did not wait on NOT-104.

Design point worth recording: the route had no workspace context and could not get one. It is reached by <img src>, which cannot set X-Workspace-Id, and the URL stored in block content is a bare /attachments/<ulid>.<ext>. So the workspace is recovered rather than declared — the attachment id is looked for in the workspaces the caller belongs to, short-circuiting on the first hit. Attachment ids are ULIDs and globally unique, so at most one workspace holds a given one, and searching only the caller's own workspaces means a miss leaks nothing. Alternatives considered and rejected in ADR-006: workspace in the URL (needs migrating stored block content), a platform-level id-to-workspace index (needs a table, a write on upload, and a backfill), and a query parameter (still has to be verified against membership, so it saves nothing).

Miss versus denial is deliberate: a file in no workspace of the caller's is a 404 decided before the disk is touched; a file found but on an unreadable page is a 403, which leaks nothing they did not already know.

Blocked mid-way by NOT-123 — authenticated upload was returning 500 on main, so attachments could not be created to test against. Filed and fixed separately; confirmed reproducible on a clean checkout first.

The feared consequence turned out to be small: attachment URLs are relative and only ever resolved by the app in a cookie-bearing same-origin request, so nothing in the repo depended on anonymous fetching. Recorded in the ADR anyway, since anyone who pasted such a URL elsewhere will find it stops working.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Attachments follow their page (ADR-006).

Serving an attachment required no session at all. Path traversal was blocked; access was not. Every uploaded image and PDF in every workspace was readable by anyone holding the ULID — including a user removed yesterday, a member with no access to the locked page the file sits on, and anyone the URL was ever pasted to. The de facto policy was a capability URL that nobody had chosen, sitting underneath a page ACL users are told controls who sees their content.

Changes:
- handlers/attachments.ts (new): resolves a served file name to its attachment and authorizes it, by looking for the id in the workspaces the caller belongs to and then checking viewer access on the owning page. A miss returns null; a denial fails with the usual 403.
- index.ts: the attachment route now requires a session and authorizes before touching the disk, so an unreadable file is indistinguishable from a missing one. Failures map through the shared error response instead of collapsing to 500.
- docs/adr/006-attachment-access.md: records the decision, the workspace-recovery approach and the alternatives rejected, the miss-versus-denial rule, and the consequence for bare URLs. Supersedes the access posture left unstated by ADR-001.
- route-auth.test.ts: the route joins the anonymous-caller guard list.
- e2e/multiuser-access.spec.ts: a member reads an attachment while the page is open, loses it the moment the page is locked, and the owner keeps it; a non-member gets 404 rather than 403.

Tests: server 176 pass / 0 fail; type-check clean; biome clean; multiuser-access 12 passed.

Follow-up already noted in the ADR: public page sharing (NOT-42/43) must extend this check rather than bypass it, and NOT-104 will express it as a declarative rewrite rule without changing the decision.
<!-- SECTION:FINAL_SUMMARY:END -->
