---
id: NOT-83
title: Invite link joins the workspace but drops the invitee on /workspaces
status: done
assignee:
  - '@claude'
created_date: '2026-08-04 14:59'
updated_date: '2026-08-04 16:00'
labels:
  - bug
dependencies: []
priority: medium
ordinal: 71000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
routes/join.$token.tsx joins over RPC then throws redirect() to /$workspaceSlug from inside a try block whose catch falls back to /workspaces unless err?.isRedirect is set. In practice the invitee lands on the workspace picker with no confirmation that the invite worked. Proven by E2E: membership is granted (getMyWorkspaces contains the workspace) but the browser ends up at /workspaces instead of the workspace. Failing spec: e2e/multiuser-access.spec.ts ('a second user joins through the invite link and sees the workspace content'). Related: NOT-78.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Opening a valid invite link lands the user inside the invited workspace
- [x] #2 An invalid or expired invite token still falls back gracefully with an explanation
- [x] #3 The failing spec in e2e/multiuser-access.spec.ts passes
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
join.$token.tsx now guards only the RPC call. The success redirect was thrown inside the try, where the catch caught it and downgraded it to the /workspaces fallback unless err.isRedirect happened to be set — so invitees who had in fact joined were dropped on the workspace picker with no explanation.

The failure toast no longer echoes the server's message: joinWorkspaceByToken fails with a plain Error, which the RPC boundary flattens to {} (the same defect as NOT-82), so the toast body would literally read '{}'. It now states that the link is invalid or has been replaced, which covers both failure modes truthfully.

Tests: 'a second user joins through the invite link and sees the workspace content' in e2e/multiuser-access.spec.ts now passes, asserting both that membership is granted and that the browser lands inside the workspace.
<!-- SECTION:FINAL_SUMMARY:END -->
