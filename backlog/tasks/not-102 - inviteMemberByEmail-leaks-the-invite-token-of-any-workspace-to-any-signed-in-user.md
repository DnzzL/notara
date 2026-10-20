---
id: NOT-102
title: >-
  inviteMemberByEmail leaks the invite token of any workspace to any signed-in
  user
status: done
assignee:
  - '@thomas'
created_date: '2026-08-26 10:11'
updated_date: '2026-08-26 11:35'
labels:
  - bug
dependencies: []
priority: high
ordinal: 97000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
rpc-handlers.ts:785 inviteMemberByEmail only calls getSessionUser — no membership or owner check, unlike removeMember/regenerateInviteLink right above it. handlers/workspaces.ts:227 then loads the workspace by id and emails the caller-supplied address a join link containing ws.invite_token. Any authenticated user who knows or guesses a workspaceId can mail themselves a working invite link and join an arbitrary workspace, and learn its name. Found during the pre-release architecture review.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 inviteMemberByEmail requires the caller to be a member (owner or admin) of the target workspace, matching the neighbouring member-management RPCs
- [x] #2 A regression test asserts a non-member calling inviteMemberByEmail on someone else's workspace is rejected and no email is sent
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Guard added at the RPC layer, matching removeMember and regenerateInviteLink next to it: requireWorkspaceOwner rather than a bare session check. Owner rather than any member, because the mail body carries the workspace invite token, so sending it is the same capability as rotating the link. No UI change needed — the settings panel already renders the invite form only to the owner.

Regression tests live in e2e/multiuser-access.spec.ts, whose docstring already framed this exact risk (the RPC router has no global auth gate, so each handler is the only line of defence). Two cases: a plain member, and a non-member against a workspace they were never in. Both verified to FAIL against the pre-fix code and pass after.

The 'no email is sent' criterion holds structurally: the guard rejects before the handler that sends the mail ever runs.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Require workspace ownership to mail out an invite.

inviteMemberByEmail checked only that a session existed. It then loaded any workspace by id and emailed a caller-supplied address a join link containing that workspace's invite token — so any signed-in user who knew a workspace id could mail themselves in, and learn the workspace name on the way.

Changes:
- rpc-handlers.ts: inviteMemberByEmail now calls requireWorkspaceOwner, matching removeMember and regenerateInviteLink immediately above it. Owner rather than member because the mail carries the invite token, making it the same capability as rotating the link; the settings panel already gated the form to owners, so no UI change was needed.
- e2e/multiuser-access.spec.ts: two regression tests — a member cannot mail out the invite token, and a non-member cannot mail themselves an invite to a workspace they were never in (also asserting they remain outside afterwards).

Tests: server suite 175 pass / 0 fail; server type-check clean; multiuser-access spec 9 passed. Both new tests were confirmed to fail against the pre-fix handler before the guard was restored.

Risk: none expected for owners. A workspace member who previously reached this RPC outside the UI now gets a 403.
<!-- SECTION:FINAL_SUMMARY:END -->
