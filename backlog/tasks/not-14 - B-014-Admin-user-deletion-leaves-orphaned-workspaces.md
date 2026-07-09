---
id: NOT-14
title: 'B-014: Admin user deletion leaves orphaned workspaces'
status: done
assignee: []
created_date: '2026-06-12 13:56'
updated_date: '2026-06-12 16:42'
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
- [x] #1 Deleting a user no longer removes the user row (only workspace_members)
- [x] #2 bun --bun tsc --noEmit -p packages/server passes
- [x] #3 bun test packages/server/test passes
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Decision: Zanzibar principle — never cascade-delete owned resources. Instead of hard-deleting user row, just remove workspace memberships and stop there. User row stays (inert), workspace ownership preserved, no orphaned workspaces. Better Auth still validates session but user has no workspace access → sees empty dashboard.

Changes applied to packages/server/src/index.ts (DELETE /api/admin/users/:userId):
1. Removed `platformDb.prepare(`DELETE FROM "user" WHERE id = ?`).run(userId)` — user row is kept
2. Added `yield* Effect.logInfo("User deactivated", userId)` — log the action
3. Changed response from `{ deleted: true }` to `{ deactivated: true }`
- Verified: tsc --noEmit passes (0 errors), all 118 tests pass
<!-- SECTION:NOTES:END -->
