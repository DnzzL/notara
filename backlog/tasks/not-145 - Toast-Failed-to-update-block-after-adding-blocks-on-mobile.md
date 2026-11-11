---
id: NOT-145
title: Toast 'Failed to update block' after adding blocks on mobile
status: needs-info
assignee: []
created_date: 2026-10-10 18:03
updated_date: '2026-11-10T17:08:00Z'
labels:
  - bug
dependencies: []
priority: medium
ordinal: 140000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Seen once at 390px emulation: tapping 'New block' then 'Add block' on a fresh page showed 'Failed to update block'. Server log had no error status (RPC error inside a 200). Repro not yet isolated.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Root cause identified and repro written as a test
- [ ] #2 No error toast when adding blocks on a fresh page
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Not reproduced (NA-4). Tried: fresh account+workspace, blank page, 390px touch emulation, 'New block' then 'Add block' with 0ms/50ms gap, RPC delayed 1.5s, 4s gap before second tap. All createBlock = Success, no updateBlock sent, no toast.
Only NotFoundError can come out of updateBlock (handlers/blocks.ts), so the toast means an update reached the server for a block it lacks.
Latent hole (not confirmed as the cause): blockStore.afterCreate() swallows a failed create, so a pending save for that block still fires and returns 'not found' -> second spurious toast beside 'Failed to create block'.
Need: server log line / RPC payload (tag + block id) next time it shows, and whether 'Failed to create block' toast appeared first.

Review lead (~60%, not reproduced): BlockEditor.tsx:234-246 save timer (200ms) is never cancelled on unmount. Type, then Backspace-merge/delete the block within 200ms -> store deletes, delete RPC sent, stale timer fires updateBlock for the deleted id -> NotFound -> toast. afterCreate guards creates only, not deletes. Repro to try: type 1 char, Backspace twice fast, delay RPC.
Other errors can also surface in a 200 (BlockLockedError, AuthError, SQL defect). Ask for the toast's description text (String(e)): it names the real error.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
No fix: bug not reproduced after real attempt (see notes). No code changed. Next step: capture failing updateBlock payload when it recurs.
<!-- SECTION:FINAL_SUMMARY:END -->
