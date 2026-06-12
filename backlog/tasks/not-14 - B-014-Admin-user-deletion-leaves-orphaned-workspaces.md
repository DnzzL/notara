---
id: NOT-14
title: 'B-014: Admin user deletion leaves orphaned workspaces'
status: needs human validation
assignee: []
created_date: '2026-06-12 13:56'
updated_date: '2026-06-12 14:05'
labels:
  - bug
dependencies: []
references:
  - 'packages/server/src/index.ts:175-179'
priority: low
ordinal: 14000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Deleting a user from the admin panel removes membership rows but leaves owned workspaces orphaned (owner_id points at deleted user). Workspace DB files remain on disk permanently.\n\nFile: packages/server/src/index.ts:175-179\n\nFix: Cascade-delete owned workspaces including their DB files, transfer ownership, or at minimum log a warning.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Deleting a user either transfers workspace ownership or deletes workspace DB files
- [ ] #2 bun --bun tsc --noEmit -p packages/server passes
- [ ] #3 bun test packages/server/test passes
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Three approaches: (a) transfer ownership to another user before deleting, (b) cascade-delete the workspace DB files, (c) just log a warning. What should happen to the workspace data when the sole owner is deleted?
<!-- SECTION:NOTES:END -->
