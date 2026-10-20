---
id: NOT-79
title: >-
  Workspace membership RPCs are unauthenticated: member list, invite rotation,
  member eviction
status: done
assignee:
  - '@claude'
created_date: '2026-08-04 14:58'
updated_date: '2026-08-04 15:59'
labels:
  - bug
dependencies: []
priority: high
ordinal: 67000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
getWorkspaceMembers, regenerateInviteLink and removeMember in rpc-handlers.ts call the Workspaces handlers with no getSessionUser and no membership/ownership check. The RPC router has no global auth gate, so each handler is the only line of defence. Proven by E2E: an unauthenticated caller reads the full member list including email addresses, an unauthenticated caller evicts a member (victim then gets 'Not a workspace member'), and a plain member rotates the workspace invite token. Failing specs: e2e/multiuser-access.spec.ts ('workspace membership cannot be read by an unauthenticated caller', 'an unauthenticated caller cannot evict a workspace member', 'a member cannot rotate the workspace invite token'). Related: NOT-78.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 getWorkspaceMembers requires an authenticated caller who is a member of the workspace
- [x] #2 removeMember requires an authenticated workspace owner
- [x] #3 regenerateInviteLink requires an authenticated workspace owner
- [x] #4 The three failing specs in e2e/multiuser-access.spec.ts pass
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added requireWorkspaceRole / requireWorkspaceOwner to workspace-context.ts and gated the three membership RPCs with them: getWorkspaceMembers needs membership, removeMember and regenerateInviteLink need ownership.

They authorize against the workspaceId in the request payload rather than the X-Workspace-Id header, because the workspace-settings screens (settings.$workspaceSlug.tsx, WorkspaceSettingsModal.tsx) call these RPCs without that header set.

Tests: the three previously-red specs in e2e/multiuser-access.spec.ts now pass; 176 server tests still pass. No plan/tier checks introduced, and the existing withAuthedWorkspace chokepoint was left untouched.
<!-- SECTION:FINAL_SUMMARY:END -->
