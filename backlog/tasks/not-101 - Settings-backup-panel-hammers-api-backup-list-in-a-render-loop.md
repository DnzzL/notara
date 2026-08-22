---
id: NOT-101
title: Settings backup panel hammers /api/backup/list in a render loop
status: done
assignee: []
created_date: '2026-08-22 12:38'
updated_date: '2026-08-22 12:38'
labels:
  - bug
dependencies: []
priority: high
ordinal: 96000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
BackupsPanel declared loadBackups as a plain function in the component body and listed it in a useEffect dependency array. Its identity changed on every render, so the effect refired; the effect's setBackups triggered another render, which produced another identity. The result was a continuous request loop against /api/backup/list, about ten per second, for as long as the Backups settings panel stayed open. Observed in production access logs. Introduced in 4c7ddc8 (2026-07-28), unrelated to the retention work that surfaced it.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 loadBackups has a stable identity across renders
- [x] #2 Opening the Backups panel issues one /api/backup/list request, not a continuous stream
- [x] #3 The list still refreshes when S3 backup is toggled on
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Memoized the backup-list loader with useCallback so the effect that calls it has a stable dependency.

The panel previously issued a continuous stream of GET /api/backup/list requests — about ten a second — for as long as it stayed open, because the loader's identity changed on every render, refiring the effect, whose setBackups caused the next render. Production access logs showed the loop.

Also extends NOT-99's retention purge to run once at server startup, not only after a successful backup: a bucket already over the limit previously stayed that way until the next scheduled run, which on the manual or weekly schedule is never or a week away. Startup purge failures are logged, and a missing/disabled S3 config is ignored rather than noisy.

Tests: 175 pass, server type-check clean. The 3 pre-existing app type errors are NOT-100, untouched.
<!-- SECTION:FINAL_SUMMARY:END -->
