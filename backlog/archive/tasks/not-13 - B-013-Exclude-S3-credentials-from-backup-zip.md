---
id: NOT-13
title: 'B-013: Exclude S3 credentials from backup zip'
status: needs human validation
assignee: []
created_date: '2026-06-12 13:56'
updated_date: '2026-06-12 14:05'
labels:
  - bug
dependencies: []
references:
  - packages/server/src/handlers/backup.ts
priority: low
ordinal: 13000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
S3 access key and secret key are stored in settings.json inside DATA_DIR. This directory is included in the backup zip. Anyone who gets a backup file can read the S3 credentials.\n\nFile: packages/server/src/handlers/backup.ts\n\nFix: Exclude settings.json from backup zip, or encrypt credentials at rest, or document the risk.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Backup zip does not contain settings.json
- [ ] #2 Restore still works (settings.json comes from separate config)
- [ ] #3 bun --bun tsc --noEmit -p packages/server passes
- [ ] #4 bun test packages/server/test passes
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Three approaches: (a) exclude settings.json from backup zip (simplest, but credentials won't be backed up), (b) encrypt credentials at rest before they hit disk, (c) document the risk and leave as-is. Which tradeoff is acceptable?
<!-- SECTION:NOTES:END -->
