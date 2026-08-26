---
id: NOT-111
title: Full export no longer overwrites pages that share a title
status: done
assignee:
  - '@thomas'
created_date: '2026-08-26 11:11'
updated_date: '2026-08-26 14:40'
labels:
  - bug
dependencies: []
priority: medium
ordinal: 106000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Exporting a whole workspace to a directory writes one markdown file per page, named from the sanitised page title, flat. Two pages sharing a title silently overwrite each other and the export reports success. Untested.

Titles collide constantly in practice — 'Notes', 'README', 'Meeting', or any two records of the same database exported as pages. A backup that silently drops pages is worse than one that fails.

Decide and implement a naming scheme that cannot collide, and make the export report what it wrote.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Exporting two pages with the same title produces two files, both readable
- [x] #2 The export reports the number of files written and it matches the number of pages exported
- [x] #3 A test exports a fixture containing colliding titles and asserts nothing is lost
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Databases had the same bug and are fixed with it: two databases named 'Tasks' overwrote each other in the databases/ folder exactly as pages did in the root.

Two details that make the difference between a fix and a near-fix:
- Uniqueness is judged AFTER sanitising, because 'A/B' and 'A B' both become 'A_B'. Comparing titles would have missed it.
- Comparison is case-insensitive, because macOS and Windows filesystems are. On those, 'notes.md' and 'Notes.md' are one file, so a case-sensitive allocator would still have lost data on the two platforms most users are on.

The count now matches what is on disk by construction rather than by coincidence: every page gets a distinct file, so incrementing per page and counting files agree. The integration test asserts that equality rather than trusting it.

An empty title yields 'Untitled.md' rather than a bare '.md', which on Unix is a hidden file with no name.

Both tests were verified red against the old exporter.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Stop the full export from silently overwriting pages that share a title.

Exporting a workspace wrote one file per page named from the sanitised title, flat. Two pages sharing a title — 'Notes', 'README', or any two records of a database exported as pages — overwrote each other and the export reported success. A backup that drops pages without saying so is the worst shape this bug can take. Databases had the same problem in their own folder.

Changes:
- export/page.ts: makeFilenameAllocator hands out names that cannot collide, appending ' (2)', ' (3)' before the extension. Uniqueness is judged after sanitising, since 'A/B' and 'A B' both become 'A_B', and case-insensitively, since macOS and Windows treat 'notes.md' and 'Notes.md' as one file. An empty title becomes 'Untitled' rather than a bare extension.
- exportAllToDirectory uses one allocator per output folder, so a page and a database may still share a name.
- Seven unit tests for the allocator, plus an integration test that exports three pages titled 'Notes' and asserts three distinct files exist, that the reported count matches what is on disk, and that the three files hold different content rather than three copies of one.

Both test levels were verified red against the old exporter.

Tests: 220 unit pass / 0 fail, both type-checks and biome clean.
<!-- SECTION:FINAL_SUMMARY:END -->
