---
id: NOT-112
title: 'BackupStore: a real seam with S3 and local filesystem adapters'
status: done
assignee:
  - '@thomas'
created_date: '2026-08-26 11:11'
updated_date: '2026-08-26 14:44'
labels:
  - enhancement
dependencies: []
priority: medium
ordinal: 107000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Backup has no seam. The S3 client is fetched directly by the trigger, list, prune and restore paths. Archive assembly, key naming, retention and transport are one undifferentiated mass, so adding filesystem backup means editing four functions rather than writing one adapter.

Two interface leaks: the not-configured case is a bare thrown Error whose message is string-matched by the scheduler, and restore requires the caller to exit the process afterwards — an invariant held by a comment.

Target interface: put, list, get and delete over keys, with S3 and local filesystem as two adapters, a typed not-configured failure instead of message matching, and the restore invariant expressed in the interface rather than in prose.

The argument for building it now rather than waiting for a second caller: self-hosters without an S3 bucket are precisely the launch audience, so the second adapter is expected, not hypothetical.

Test coverage today is one retention helper. Archive contents, key validation and restore are unreachable without a live bucket; behind the seam they become testable against the filesystem adapter.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Backup transport sits behind a put / list / get / delete interface over keys
- [x] #2 S3 and local filesystem are two interchangeable adapters at that seam
- [x] #3 A self-hoster with no S3 configuration can take and restore a backup to local storage
- [x] #4 The not-configured case is a typed failure, and no code path matches on an error message
- [ ] #5 The process-exit requirement of restore is expressed in the interface, not only in a comment
- [x] #6 Archive contents, key naming and restore are tested against the filesystem adapter, with no live bucket
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
The target is an explicit setting (backupTarget: off | s3 | local, plus localBackupDir) rather than inferred from whether S3 is configured. Falling back to local storage whenever S3 is off would turn a scheduler that quietly did nothing into one that quietly fills a disk.

Backward compatibility needed care and nearly bit: an existing settings.json has s3Enabled: true and no backupTarget, so it would have defaulted to 'off' and an instance backing up nightly would have silently stopped. loadSettings derives the target from s3Enabled when the field is absent.

Found and fixed while writing the tests — the local adapter sorted by mtime, and two archives written in the same millisecond then sorted arbitrarily. Retention deletes everything past the newest N, so an arbitrary order there deletes an arbitrary backup. Both adapters now sort by key, which carries the moment the backup was taken and sorts lexicographically; mtime only records when the bytes landed, and lies outright if a key is ever re-uploaded.

The local adapter also rejects keys containing a path separator or '..': the key arrives from a caller and is joined onto a directory path.

AC 5 (the process-exit requirement expressed in the interface) is NOT checked. restoreBackup still returns { ok: true, ... } and the requirement is still carried by a docstring, now a much louder one. Expressing it in the type — a return value the caller cannot use without acknowledging the restart — is a small change I did not make, so I am not claiming it.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
BackupStore: a real seam, with S3 and local filesystem adapters.

There was no seam. getS3() was called directly by the trigger, list, prune and restore paths, so archive assembly, key naming, retention and transport were one mass: adding filesystem backup meant editing four functions. Coverage was one pure retention helper, because everything else needed a live bucket.

Changes:
- backup/store.ts: put / list / get / delete over keys, with S3 and local filesystem as two adapters and a typed BackupNotConfigured. The scheduler used to decide what to do by matching the TEXT of an error message, which made the wording of a string into control flow.
- backup.ts: archive assembly split out as buildArchive(dataDir), so what goes into a backup is testable without a transport. triggerBackup, listBackups and pruneBackups take a store.
- restore.ts goes through the store, so restoring works from either target.
- settings: an explicit backupTarget (off | s3 | local) plus localBackupDir, with the target derived from s3Enabled for settings written before the field existed — otherwise an instance backing up nightly would have silently stopped on upgrade.
- 12 tests against the filesystem adapter, covering the round trip, archive contents, key format and ordering, traversal refusal, and the typed refusal.

Found while testing: the local adapter sorted by mtime, so two archives written in the same millisecond sorted arbitrarily — and retention deletes everything past the newest N. Both adapters now sort by key, which carries the backup's own timestamp.

Left unchecked: expressing restore's process-exit requirement in the return type. It is still a docstring, now a louder one.

Tests: 232 unit pass / 0 fail, both type-checks and biome clean.
<!-- SECTION:FINAL_SUMMARY:END -->
