---
id: NOT-42
title: Public page-share capability + unauthenticated read endpoint
status: ready for agent
assignee: []
created_date: '2026-07-09 16:15'
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
- [ ] #1 A platform-DB page_shares table (token, workspace_id, page_id) exists via a new migration; a page has at most one live token
- [ ] #2 page_shares handler built test-first (vertical TDD on the workspaces.test.ts harness): enable returns a token, enable is idempotent, getPageShare returns token-or-null, disable removes it, resolveShareToken returns the pair-or-null
- [ ] #3 Two authed RPCs (getPageShare, setPageSharing) gated by checkPagePermission(...,'editor'); permissions.ts / acl_tuples left untouched (no new relation)
- [ ] #4 GET /api/public/pages/:token is unauthenticated, rate-limited via the existing in-process limiter, returns exactly {page, blocks} and nothing else, and 404s for a bogus/revoked token or a soft-deleted page
- [ ] #5 bun --bun tsc --noEmit -p packages/server exits 0 and bun test packages/server/test passes including the new page-shares tests
<!-- AC:END -->
