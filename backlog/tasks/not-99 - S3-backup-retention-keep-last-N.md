---
id: NOT-99
title: 'S3 backup retention: keep last N'
status: done
assignee: []
created_date: '2026-08-22 10:26'
updated_date: '2026-08-22 12:38'
labels:
  - enhancement
dependencies: []
priority: medium
ordinal: 94000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Backups were never pruned; the bucket grew without bound (a full zip per run, up to 24/day on the hourly schedule). Adds a keep-last-N retention policy applied after each successful backup.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 New s3KeepLast setting (default 10, 0 = unlimited) with S3_KEEP_LAST env override
- [x] #2 Backups beyond the N most recent are deleted after each successful backup
- [x] #3 The restore safety snapshot never triggers a purge
- [x] #4 A failed purge does not fail the backup
- [x] #5 Setting is editable in the Backups settings panel
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Follow-up (NOT-101): purge-after-backup alone left an already-oversized bucket untouched until the next scheduled run. pruneBackups() now also runs once at server startup.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Adds a keep-last-N retention policy to S3 backups.

Before: nothing ever deleted a backup. Every run uploads a full zip (no incremental), so an hourly schedule left 24 full copies of the instance per day in the bucket, forever.

Changes:
- settings.ts: new `s3KeepLast` (default 10, 0 = keep everything) + `S3_KEEP_LAST` env override.
- backup.ts: `selectExpired(items, keepLast)` (pure, tested) and `pruneBackups()` which deletes everything beyond the N newest via DeleteObjects, batched at 1000 keys. Called at the end of `triggerBackup()`; a purge failure is logged and swallowed so it can never fail a backup that already succeeded.
- restore.ts: the pre-restore safety snapshot now calls `triggerBackup({ prune: false })` — otherwise a low keepLast could have purged the very backup being restored.
- BackupsPanel.tsx: 'Keep last' number field.
- .env.example / docker-compose.yml: document S3_KEEP_LAST.

Tests: new packages/server/test/backup-retention.test.ts (7 cases: unlimited, negative, under/at/over limit, keepLast=1, empty). Full suite 175 pass. Both type-checks clean.
<!-- SECTION:FINAL_SUMMARY:END -->
