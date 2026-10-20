---
id: NOT-44
title: Workspace teardown primitive + ephemeral demo-purge job
status: done
assignee:
  - '@agent'
created_date: '2026-07-09 16:16'
updated_date: '2026-08-04 18:43'
labels:
  - enhancement
dependencies: []
ordinal: 47000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Build the safety-critical core of ephemeral demo workspaces: a reusable workspace hard-delete (SQLite file + in-process layer-cache eviction + explicit platform-row deletes, since the FK cascade pragma is OFF) plus a scheduled purge that removes expired demo-marked workspaces. Detailed spec: plans/004-ephemeral-demo-workspaces.md. Env-gated, off by default (DEMO_MODE). Yields a reusable teardown primitive a later not-14 fix can call. Built test-first — the single most important assertion is that a NON-demo workspace is never purged.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 deleteWorkspaceDb(workspaceId) removes the workspace .db file (incl. -wal/-shm), evicts the in-process layer cache, and is idempotent
- [x] #2 Migration named 003_demo_workspaces.sql (next in the platform sequence, applied by applyMigrations at import — NOT runMigrations) adds BOTH workspaces.is_demo AND user.isAnonymous (the better-auth anonymous plugin requires the latter column)
- [x] #3 A purge job (modeled on trash-sweeper) removes workspaces where is_demo=1 AND created_at older than DEMO_TTL_HOURS: workspace row, member rows, .db file, and the owning anonymous user when it owns nothing else — using real better-auth table/column names verified against 000_better_auth.sql
- [x] #4 Purge logic is built test-first with injection (db, ttlHours, deleteDb-stub) and includes a passing assertion that a non-demo workspace older than the TTL is NEVER removed, and a within-TTL demo workspace is kept
- [x] #5 startDemoPurge is wired in bootstrap only when DEMO_MODE=true; server typecheck passes and bun test packages/server/test passes with the new demo-purge tests
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Migration platform/003_demo_workspaces.sql: workspaces.is_demo INTEGER NOT NULL DEFAULT 0 + user.isAnonymous INTEGER NOT NULL DEFAULT 0 (applyMigrations picks it up at platform-db import).
2. db.ts: export workspacesDir + deleteWorkspaceDb(workspaceId) — rm .db/-wal/-shm with force (idempotent) and evict workspaceLayerCache.
3. New demo-purge.ts: pure injectable purgeExpiredDemos({ db, ttlHours, deleteDb }) returning purged ids. Selects is_demo=1 AND datetime(created_at) < datetime(cutoff); per workspace deletes workspace_members rows, workspaces row, calls deleteDb, then deletes the owner when user.isAnonymous=1 and it owns no other workspace (explicit session/account/member deletes because the SQLite FK pragma is OFF).
4. startDemoPurge(): trash-sweeper-shaped setInterval wrapper reading DEMO_TTL_HOURS; wired in index.ts only when DEMO_MODE=true.
5. Tests first in test/demo-purge.test.ts — the load-bearing one: a NON-demo workspace older than the TTL is never purged. Plus within-TTL demo kept, anonymous owner reaped only when it owns nothing else, non-anonymous owner never deleted, deleteWorkspaceDb idempotency.
6. Verify: bun --bun tsc --noEmit -p packages/server and bun test packages/server/test.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- Added platform migration 003_demo_workspaces.sql (workspaces.is_demo + user.isAnonymous); applyMigrations picks it up at platform-db import. Confirmed applied to .data/platform.db and recorded in _migrations.
- db.ts: workspaceDbFile() + deleteWorkspaceDb() — evicts workspaceLayerCache then fs.rmSync(force) on .db/-wal/-shm, so it is idempotent.
- New src/demo.ts: DEMO_MODE / DEMO_TTL_HOURS env flags, purgeExpiredDemos({db,ttlHours,deleteDb}) as a pure injectable function, and startDemoPurge() (immediate tick then hourly, trash-sweeper shaped).
- Purge deletes member rows, the workspace row, the SQLite file, and the owning user only when user.isAnonymous=1 and it owns no other workspace; session/account/member rows are deleted explicitly because the SQLite FK pragma is OFF.
- Wired in index.ts bootstrap behind 'if (DEMO_MODE) startDemoPurge()'.
- Tests written first in test/demo-purge.test.ts (8 tests), including the load-bearing 'NEVER purges a non-demo workspace older than the TTL' and 'keeps a demo workspace within the TTL'.
- Note: plans/004-ephemeral-demo-workspaces.md referenced by the description does not exist in the repo; implemented against the ACs.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Adds the safety-critical core of ephemeral demo workspaces: a reusable workspace teardown primitive plus an env-gated purge job.

Changes:
- packages/server/migrations/platform/003_demo_workspaces.sql — adds workspaces.is_demo and user.isAnonymous (the latter is what the better-auth anonymous plugin needs). Applied by applyMigrations at platform-db import, tracked in _migrations.
- packages/server/src/db.ts — new workspaceDbFile(id) and deleteWorkspaceDb(id). The latter evicts the in-process workspace layer cache and removes the .db plus its -wal/-shm sidecars with force, so it is idempotent and a later reopen recreates a fresh migrated database. Reusable by a future not-14 fix.
- packages/server/src/demo.ts — DEMO_MODE / DEMO_TTL_HOURS env flags; purgeExpiredDemos({ db, ttlHours, deleteDb }) fully injectable and synchronous; startDemoPurge() runs it immediately then hourly.
- packages/server/src/index.ts — startDemoPurge() called from bootstrap only when DEMO_MODE=true. Off by default, so a normal self-hosted install is unaffected.

Safety: only is_demo=1 rows are ever selected. Because the SQLite FK pragma is OFF in this codebase nothing cascades, so workspace_members, session and account rows are deleted explicitly. The owning user is removed only when it is isAnonymous=1 AND owns no other workspace.

Tests: packages/server/test/demo-purge.test.ts, written before the implementation — 8 tests covering the non-demo-older-than-TTL never purged case, within-TTL demo kept, anonymous owner reaped, anonymous owner kept when it owns another workspace, non-anonymous owner never deleted, and deleteWorkspaceDb file removal / idempotency / cache eviction.

Verification: bun --bun tsc --noEmit -p packages/server clean; bun test packages/server/test = 129 pass / 0 fail.
<!-- SECTION:FINAL_SUMMARY:END -->
