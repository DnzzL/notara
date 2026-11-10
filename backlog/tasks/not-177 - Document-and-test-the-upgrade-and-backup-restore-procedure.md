---
id: NOT-177
title: Document and test the upgrade and backup-restore procedure
status: ready-for-agent
assignee: []
created_date: '2026-11-10T17:05:00Z'
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
- [ ] #1 Doc covers upgrade, rollback, backup and restore for the local-fs target and S3
- [ ] #2 Test: seeded instance -> backup -> restore into a fresh dir -> data intact
- [ ] #3 Test: data dir from the previous release boots on the current migrations
- [ ] #4 Doc commands are the ones exercised by the test
<!-- AC:END -->
