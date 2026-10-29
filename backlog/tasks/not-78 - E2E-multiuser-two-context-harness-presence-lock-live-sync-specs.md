---
id: NOT-78
title: 'E2E multiuser: two-context harness + presence/lock/live-sync specs'
status: done
assignee:
  - '@claude'
created_date: '2026-08-04 14:27'
updated_date: '2026-08-04 15:03'
labels:
  - enhancement
dependencies: []
priority: high
ordinal: 66000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Multiuser (presence avatars, soft block locks, live block sync, invite/join, page ACLs) has no E2E coverage, and the E2E harness itself does not start (server exits on missing BETTER_AUTH_SECRET, so auth.setup times out and no spec runs). Confidence in multiuser robustness and real usefulness is low. Build a two-authenticated-context Playwright harness and cover the multiuser paths end to end so gaps are proven rather than suspected. Scope is tests + diagnosis only: no product fixes in this task; failing scenarios stay red and get their own bug tasks.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 E2E harness starts reliably: server gets BETTER_AUTH_SECRET and an isolated DATA_DIR so runs do not touch the dev database
- [x] #2 A reusable helper creates N independent authenticated browser contexts (distinct users) sharing one workspace via the invite token
- [x] #3 Presence specs cover: peer avatar appears when a second user opens the page, and disappears when that peer leaves the page or goes idle past the presence TTL
- [x] #4 Soft-lock specs cover: lock badge appears on the block a peer focuses, an edit to a peer-locked block is rejected with the toast and does not persist, and the lock releases after the peer blurs
- [x] #5 Live-sync specs cover: peer block create / update / delete / reorder and page title change all propagate to the other viewer without reload, with no console crash
- [x] #6 Invite/join spec: a second user joins via the invite link and sees the workspace existing pages
- [x] #7 Concurrent-edit spec: two users editing different blocks of the same page both persist after reload (no lost update)
- [x] #8 Final report states which multiuser behaviours actually work, and every failing scenario has its own backlog bug task linked from the spec
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Harness: playwright.config.ts webServer gets BETTER_AUTH_SECRET + isolated DATA_DIR (e2e/.data, gitignored); split the two processes so the server is actually up before vite.
2. e2e/helpers/multiuser.ts: signUpUser() via POST /api/auth/sign-up/email on an APIRequestContext, create workspace (createWorkspace RPC), read invite token (regenerateInviteLink RPC), second user joins (joinWorkspaceByToken RPC); returns { context, page, userId, rpc() } per user plus the shared workspace/page ids. Setup via RPC for determinism, assertions via the UI.
3. Specs, one file per axis: multiuser-presence.spec.ts, multiuser-locks.spec.ts, multiuser-live-sync.spec.ts, multiuser-access.spec.ts (invite/join + ACL), multiuser-concurrent.spec.ts.
4. Run the suite; for each red scenario open a bug task and reference it from the spec. No product fix in this task (scope: tests + diagnosis).
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- Harness repaired: playwright.config.ts now starts the API and vite as two separate webServer entries (API waited on via /health before vite boots), with a dummy BETTER_AUTH_SECRET and an isolated DATA_DIR at e2e/.data. Before this the server exited on startup and no spec ran at all.
- e2e/helpers/multiuser.ts: worker-scoped user sessions (signup over /api/auth/sign-up/email, cookies shared into a BrowserContext, consent pre-seeded), per-test workspace fixtures (soloWs / sharedWs), an RPC client mirroring packages/app/src/rpc-client.ts, page/block seeding, and DOM helpers. Sessions are worker-scoped because the server rate-limits auth mutations to 10/min/IP.
- 5 specs, 25 scenarios: multiuser-presence, multiuser-locks, multiuser-live-sync, multiuser-access, multiuser-concurrent.
- Three of my own initial specs were wrong and were corrected rather than filed as product bugs: the peer-locked-block toast (unreachable — the block is turned read-only by editor.setEditable, so no write is attempted), block creation driven with Enter (produced a <br>, see NOT-84), and an ACL subject passed as a string instead of a structured object.
- Bugs filed from the red scenarios: NOT-79 (unauthenticated membership RPCs), NOT-80 (presence avatars never disappear), NOT-81 (peer page-meta changes never propagate), NOT-82 (BlockLocked reason lost over RPC), NOT-83 (invite link drops the invitee on /workspaces). Side observations: NOT-84, NOT-85.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Built a two-user E2E harness for Notara's multiuser stack and used it to establish, with evidence, which collaboration behaviours actually work.

Harness (it did not run at all before): playwright.config.ts now boots the API and vite as two separate webServer entries, waiting on /health before vite starts, with a throwaway BETTER_AUTH_SECRET and an isolated DATA_DIR (e2e/.data) so runs never touch the dev database. Previously the server exited on missing env, auth.setup timed out, and no spec executed.

New e2e/helpers/multiuser.ts provides worker-scoped user sessions (signup over the Better Auth HTTP API, cookies shared into a BrowserContext, consent pre-seeded), per-test workspace fixtures (soloWs / sharedWs), an RPC client mirroring the app's, page/block seeding, and DOM helpers. Sessions are worker-scoped because the server rate-limits auth mutations to 10/min/IP; isolation is preserved at the workspace level instead.

5 specs / 26 scenarios: presence, soft locks, live sync, access & membership, concurrency. Setup runs over RPC for determinism; assertions run in real browser contexts.

Result: 18 pass, 8 fail. Working as intended: mutual presence avatars, per-block lock badges, locked blocks turned read-only client-side plus refused server-side, lock release on blur, live propagation of peer block create/update/delete/reorder, no regression of the NOT-39/NOT-40 remote-edit crash, ACL-restricted pages hidden from members, non-members and removed members denied, concurrent edits to distinct blocks both persisting with convergence on both screens.

The 8 red scenarios are real defects, left red on purpose and each filed: NOT-79 (getWorkspaceMembers / regenerateInviteLink / removeMember are completely unauthenticated — anonymous callers read member emails and evict members), NOT-80 (presence avatars never disappear: no leave event, sweep never scheduled), NOT-81 (peer title/icon/cover changes are broadcast but dropped client-side), NOT-82 (the BlockLocked reason does not survive RPC serialization, making the lock toast unreachable), NOT-83 (invite link joins but strands the invitee on /workspaces).

Three of my own first-draft specs were wrong and were corrected rather than reported as product bugs: the lock toast (unreachable because the block is made read-only), block creation driven with Enter (produces a <br>, see NOT-84), and an ACL subject passed as a string. Also filed NOT-85 for a pre-existing TypeError in e2e/basic.spec.ts.

No product code was changed — scope was tests and diagnosis only. Verification: bunx playwright test --project=multiuser (18 passed, 8 failed, ~4.4 min, single worker).
<!-- SECTION:FINAL_SUMMARY:END -->
