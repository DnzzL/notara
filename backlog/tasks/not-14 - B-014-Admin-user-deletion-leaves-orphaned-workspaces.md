---
id: NOT-14
title: 'B-014: Admin user deletion leaves orphaned workspaces'
status: ready for agent
assignee: []
created_date: '2026-06-12 13:56'
updated_date: '2026-06-12 15:54'
labels:
  - bug
  - ready-for-agent
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
Decision: Zanzibar principle — never cascade-delete owned resources. Instead of hard-deleting user row, just remove workspace memberships and stop there. User row stays (inert), workspace ownership preserved, no orphaned workspaces. Better Auth still validates session but user has no workspace access → sees empty dashboard.

Changes needed:
1. In admin DELETE /api/admin/users/:userId — remove the second DELETE ("user") line. Keep workspace_members removal.
2. Optionally add Effect.logInfo('User deactivated', userId) to acknowledge the action.
3. No migration needed, no schema change. The admin response can say 'deactivated' instead of 'deleted'.
<!-- SECTION:NOTES:END -->
