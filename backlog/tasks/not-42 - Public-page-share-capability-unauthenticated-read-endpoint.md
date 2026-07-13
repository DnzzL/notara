---
id: NOT-42
title: Public page-share capability + unauthenticated read endpoint
status: ready-for-agent
assignee:
  - '@agent-k'
created_date: '2026-07-09 16:15'
updated_date: '2026-07-12 08:15'
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

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Create platform migration 003_page_shares.sql (page_shares table with token PK, workspace_id, page_id, UNIQUE page_id)
2. Build page-shares handler (packages/server/src/handlers/page-shares.ts) with enableSharing, disableSharing, getPageShare, resolveShareToken — using SqlClient on the platform DB
3. Write tests in workspaces.test.ts (test-first) covering: enable returns token, enable idempotent, getPageShare returns token-or-null, disable removes it, resolveShareToken returns pair-or-null
4. Add getPageShare + setPageSharing RPC schemas to shared/api.ts
5. Wire RPC handlers in rpc-handlers.ts, gated by checkPagePermission(...,'editor')
6. Add GET /api/public/pages/:token route in index.ts (unauthenticated, rate-limited, returns {page,blocks}, 404 for invalid/revoked/soft-deleted)
7. Typecheck and run tests
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented NOT-42: Public page-share capability + unauthenticated read endpoint.

Files created:
- packages/server/migrations/platform/003_page_shares.sql — page_shares table (token, workspace_id, page_id, created_at) with UNIQUE page_id constraint
- packages/server/src/handlers/page-shares.ts — enableSharing, disableSharing, getPageShare, resolveShareToken (using PlatformDb, matching workspaces.ts pattern)

Files modified:
- packages/server/test/workspaces.test.ts — added 6 page_shares tests (TDD)
- packages/shared/src/api.ts — added getPageShare + setPageSharing RPC schemas
- packages/server/src/rpc-handlers.ts — wired RPC handlers with checkPagePermission editor gate
- packages/server/src/index.ts — added GET /api/public/pages/:token (unauthenticated, rate-limited)

All 124 tests pass, no new type errors.

Tests pass: 124 pass, 0 fail across 7 test files.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added public page-sharing capability (server half).

Changes:
- New platform migration 003_page_shares.sql with page_shares table (token, workspace_id, page_id) and UNIQUE page_id constraint
- New handler module page-shares.ts with 4 functions: enableSharing (idempotent), disableSharing, getPageShare, resolveShareToken
- Two authed RPCs (getPageShare, setPageSharing) gated by checkPagePermission(...,editor)
- Unauthenticated GET /api/public/pages/:token — rate-limited, returns {page, blocks}, 404s for invalid/revoked/soft-deleted
- 6 new TDD tests on workspaces.test.ts harness

Key decisions:
- page_shares is a capability table, NOT a Zanzibar relation
- crypto.randomUUID() tokens
- Rate-limited via existing in-process limiter (30 req/min/IP)

Tests: 124 pass, 0 fail. No new typecheck errors.
<!-- SECTION:FINAL_SUMMARY:END -->
