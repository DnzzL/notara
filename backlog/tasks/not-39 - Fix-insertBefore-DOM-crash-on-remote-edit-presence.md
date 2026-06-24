---
id: NOT-39
title: Fix insertBefore DOM crash on remote edit (presence)
status: needs-triage
assignee: []
created_date: '2026-06-23 19:31'
labels:
  - bug
dependencies: []
priority: high
ordinal: 44000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Runtime error 'Failed to execute insertBefore on Node: The node before which the new node is to be inserted is not a child of this node' fires when another user edits a block on a page you are viewing (multiplayer presence). Suspected cause: the remote block.updated SSE handler (lib/presenceConnection.ts) writes block.content into the store, triggering the content-sync effect in BlockEditor.tsx (~L216-225) to call editor.commands.setContent() on the unfocused editor. ProseMirror rebuilds the editor DOM, desyncing React-managed node views/portals (CalloutExtension uses ReactNodeViewRenderer; BubbleMenu/EmojiPicker portal to document.body), so React's next commit calls insertBefore on a detached parent.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Reproduce: two clients on same page, one edits a block (esp. a callout) while the other has it unfocused; no console error
- [ ] #2 Remote content updates still render on the observing client
- [ ] #3 No regression to local editing / focus / lock badge behavior
<!-- AC:END -->
