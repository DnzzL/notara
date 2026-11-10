---
id: NOT-177
title: Document and test the upgrade and backup-restore procedure
status: done
assignee: []
created_date: '2026-11-10T17:05:00Z'
updated_date: '2026-11-10T21:08:00Z'
labels:
  - enhancement
milestone: m-1
dependencies: []
priority: high
ordinal: 149000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Why: 'self-host in 1 minute' is only credible if upgrading and restoring is boring. Builds on the BackupStore seam (NOT-112). Restore triggers process exit + restart by design (orchestrator).
Agent brief: write one self-host doc covering upgrade (pull new image, migrations run on boot, rollback) and backup/restore (local fs and S3). Add an automated test that backs up a seeded data dir, restores it into a fresh one, and boots the migrated server on the old data.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Doc covers upgrade, rollback, backup and restore for the local-fs target and S3
- [x] #2 Test: seeded instance -> backup -> restore into a fresh dir -> data intact
- [x] #3 Test: data dir from the previous release boots on the current migrations
- [x] #4 Doc commands are the ones exercised by the test
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
README Self-host: new 'Upgrade, backup and restore' section (BACKUP_DIR / S3 targets, upgrade, rollback via previous tag + pre-upgrade backup, restore incl. exit-for-restart).
Tests (packages/server/test/upgrade-restore.test.ts) boot the real server: backup via /api/backup/trigger -> fresh dir -> /api/backup/restore -> process exits 0 -> reboot, data+admin login intact; and a v0.1.4 data dir (fixtures/v0.1.4/migrations) boots on current migrations, with a guard that released migrations are unchanged.
Checks: bun test packages/server/test (288 pass), server tsc, biome ci green.
Not covered: live S3 (same BackupStore seam, covered in backup-store.test.ts); offline restore without a running server.

Review round: doc corrected (Compose/Quadlet upgrade, BACKUP_DIR forwarding, S3-only UI, key prefix, $SESSION); tests use distinct admin accounts and open the workspace db through the server's own lazy-open path. Rollback onto an older build is documented but not exercised (restore itself is).
<!-- SECTION:FINAL_SUMMARY:END -->
