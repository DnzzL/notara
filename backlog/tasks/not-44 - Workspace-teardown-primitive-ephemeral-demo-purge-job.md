---
id: NOT-44
title: Workspace teardown primitive + ephemeral demo-purge job
status: ready for agent
assignee: []
created_date: '2026-07-09 16:16'
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
- [ ] #1 deleteWorkspaceDb(workspaceId) removes the workspace .db file (incl. -wal/-shm), evicts the in-process layer cache, and is idempotent
- [ ] #2 Migration named 003_demo_workspaces.sql (next in the platform sequence, applied by applyMigrations at import — NOT runMigrations) adds BOTH workspaces.is_demo AND user.isAnonymous (the better-auth anonymous plugin requires the latter column)
- [ ] #3 A purge job (modeled on trash-sweeper) removes workspaces where is_demo=1 AND created_at older than DEMO_TTL_HOURS: workspace row, member rows, .db file, and the owning anonymous user when it owns nothing else — using real better-auth table/column names verified against 000_better_auth.sql
- [ ] #4 Purge logic is built test-first with injection (db, ttlHours, deleteDb-stub) and includes a passing assertion that a non-demo workspace older than the TTL is NEVER removed, and a within-TTL demo workspace is kept
- [ ] #5 startDemoPurge is wired in bootstrap only when DEMO_MODE=true; server typecheck passes and bun test packages/server/test passes with the new demo-purge tests
<!-- AC:END -->
