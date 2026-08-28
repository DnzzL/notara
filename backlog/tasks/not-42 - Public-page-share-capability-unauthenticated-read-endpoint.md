---
id: NOT-42
title: Public page-share capability + unauthenticated read endpoint
status: done
assignee: []
created_date: '2026-07-09 16:15'
updated_date: '2026-08-28 07:18'
labels:
  - enhancement
dependencies: []
ordinal: 45000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Let a workspace member publish a single page as a read-only public link anyone can open without an account — the server half. Detailed spec: plans/003-public-share-to-web.md (self-contained, test-first). Sharing is a capability (a page_shares token table), NOT a Zanzibar acl_tuples relation — see the plan's Authorization-model section. Creation goes through checkPagePermission(...,'editor'); serving is a deliberate capability bypass that returns ONLY the page and its blocks. First unauthenticated read path in the app, so leak-proofing and rate-limiting are load-bearing.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A platform-DB page_shares table (token, workspace_id, page_id) exists via a new migration; a page has at most one live token
- [x] #2 page_shares handler built test-first (vertical TDD on the workspaces.test.ts harness): enable returns a token, enable is idempotent, getPageShare returns token-or-null, disable removes it, resolveShareToken returns the pair-or-null
- [x] #3 Two authed RPCs (getPageShare, setPageSharing) gated by checkPagePermission(...,'editor'); permissions.ts / acl_tuples left untouched (no new relation)
- [x] #4 GET /api/public/pages/:token is unauthenticated, rate-limited via the existing in-process limiter, returns exactly {page, blocks} and nothing else, and 404s for a bogus/revoked token or a soft-deleted page
- [x] #5 bun --bun tsc --noEmit -p packages/server exits 0 and bun test packages/server/test passes including the new page-shares tests
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
A workspace member can publish a page as a read-only public link anyone can open without an account — the server half.

Sharing is a CAPABILITY, not a Zanzibar relation. Modelling the link as an acl_tuple with a 'public' subject would put a row granting access to everyone into the same table the nearest-ancestor override walks (ADR-007), where a grant on a child silently privatises a subtree. A token in its own table cannot be confused with a relation, and revoking it is a DELETE rather than a rule.

Server:
- Migration platform/005 adds page_shares (token, workspace_id, page_id, shared_by, created_at) with UNIQUE(workspace_id, page_id) — at most one live token per page, so revoking is unambiguous. It lives in the platform DB because the token is resolved BEFORE any workspace is known.
- handlers/page-shares.ts owns the capability and nothing else: enable (idempotent, keeps the original publisher), get, disable (deletes, so re-enabling mints a fresh token and a link handed out then taken back cannot come alive again), resolveToken. Token is 192 bits of CSPRNG, not a ULID — it is the entire credential, and a ULID's leading characters are just the millisecond it was minted.
- handlers/public-page.ts decides what a stranger sees. Every no is the same null, which the route turns into one 404: 'revoked', 'never existed', 'in the bin' and 'the publisher can no longer read it' are indistinguishable.
- Two authed RPCs, getPageShare and setPageSharing, both gated by checkPagePermission(...,'editor'). permissions.ts and acl_tuples untouched.
- GET /api/public/pages/:token — unauthenticated, IP rate-limited via the existing in-process limiter, returns exactly { page, blocks }, X-Robots-Tag noindex, Cache-Control no-store.

Two things the link must not become:
- A way around the ACL. Serving a token re-checks that the PUBLISHER can still read the page (this is why shared_by is stored). A capability delegated by a person does not outlive that person's own access, so locking a page cuts every link published from it without anyone having to remember the links exist.
- A way into the rest of the workspace. pageLink, database, viewReference and people blocks are blanked SERVER-SIDE before leaving — following them would need a second access decision per block, which is the shape of NOT-102, and a client-side omission is a leak with a View Source. The page row is projected by hand to { id, title, icon, coverUrl, updatedAt }, so adding a column to pages cannot quietly widen what is published (parentId in particular names a page the token does not cover).

Attachments (amends ADR-006): a public page whose images 404 is a broken feature, so GET /api/public/pages/:token/attachments/:fileName serves a file only when its page_id is the page the token published. The token is not a key to the workspace's uploads, and the authenticated /attachments/:fileName route is unchanged.

Tests: 260 server tests pass (15 new across page-shares.test.ts and public-page.test.ts, plus a route-auth case asserting a bogus token is a plain 404, not a 500 or a 401); tsc clean on server, app and the test project; e2e/rest-public-share.spec.ts has 6 tests covering read-then-revoke, idempotence, the ACL lock cutting the link, server-side redaction, editor-gating plus noindex, and attachment scoping.

Follow-up: NOT-43 is the client half (a public reader route that renders this payload).
<!-- SECTION:FINAL_SUMMARY:END -->
