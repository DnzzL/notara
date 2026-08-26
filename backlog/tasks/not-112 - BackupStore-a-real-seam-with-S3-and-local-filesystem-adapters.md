---
id: NOT-112
title: 'BackupStore: a real seam with S3 and local filesystem adapters'
status: ready-for-agent
assignee: []
created_date: '2026-08-26 11:11'
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
- [ ] #1 Backup transport sits behind a put / list / get / delete interface over keys
- [ ] #2 S3 and local filesystem are two interchangeable adapters at that seam
- [ ] #3 A self-hoster with no S3 configuration can take and restore a backup to local storage
- [ ] #4 The not-configured case is a typed failure, and no code path matches on an error message
- [ ] #5 The process-exit requirement of restore is expressed in the interface, not only in a comment
- [ ] #6 Archive contents, key naming and restore are tested against the filesystem adapter, with no live bucket
<!-- AC:END -->
