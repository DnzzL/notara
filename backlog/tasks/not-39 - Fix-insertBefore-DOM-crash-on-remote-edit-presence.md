---
id: NOT-39
title: Fix insertBefore DOM crash on remote edit (presence)
status: ready-for-agent
assignee:
  - '@thomas'
created_date: '2026-06-23 19:31'
updated_date: '2026-07-21 15:13'
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
- [x] #1 Reproduce: two clients on same page, one edits a block (esp. a callout) while the other has it unfocused; no console error
- [x] #2 Remote content updates still render on the observing client
- [x] #3 No regression to local editing / focus / lock badge behavior
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Wire onBlockUpdated in startPresence call to dispatch block-remote-update custom event\n2. Add block-remote-update event listener in SingleBlockEditor that updates editor content (only when unfocused)\n3. The content-sync effect then sees matching content and skips setContent, preventing the DOM desync crash\n4. Run typecheck and tests to verify no regressions
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented fix: wired onBlockUpdated callback in startPresence() to dispatch a block-remote-update custom event. SingleBlockEditor listens for this event and calls editor.commands.setContent(content, false) synchronously before React's render phase, preventing the content-sync effect from triggering setContent in useEffect (which caused the ProseMirror DOM rebuild to desync ReactNodeViewRenderer-created nodes). The handler guards against overwriting local edits by checking editor.isFocused.
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: @triage
created: 2026-07-21 13:41
---
## Agent Brief

**Category:** bug
**Summary:** Remote block edits crash the observing client with 'Failed to execute insertBefore on Node: not a child of this node'

**Current behavior:**
When two users view the same page and one edits a block (especially a callout or any block using ReactNodeViewRenderer), the observing client crashes. The crash path: the `block.updated` SSE handler in `presenceConnection.ts` writes updated `block.content` directly into the Zustand block store, triggering a React re-render of `SingleBlockEditor`. The content-sync effect (`BlockEditor.tsx:388-397`) sees the editor is not focused and calls `editor.commands.setContent(expected, false)`. ProseMirror rebuilds the editor DOM, destroying and recreating node views (`CalloutExtension` uses `ReactNodeViewRenderer`). React's next reconciliation step finds DOM nodes detached by ProseMirror's rebuild, causing a `NotFoundError` on `insertBefore`.

**Desired behavior:**
Two clients on the same page: one edits any block type (including callouts), the observing client receives the updated content without crashing. Remote content updates render correctly regardless of block type. Local editing, focus, and lock badge behavior are unaffected.

**Key interfaces:**
- `packages/app/src/lib/presenceConnection.ts` — the `block.updated` SSE handler that writes `block.content` into the Zustand store. Consider whether updates should flow through a subscription channel to the relevant ProseMirror editor directly instead of (or in addition to) the store.
- `packages/app/src/components/BlockEditor.tsx` — the content-sync effect (approx. line 388-397) that calls `editor.commands.setContent()` when external content differs from editor HTML. The `startPresence()` call (approx. line 768) passes no callbacks — consider wire `onBlockUpdated` to bypass the store→re-render→setContent loop.
- `packages/app/src/components/CalloutExtension.tsx` — uses `ReactNodeViewRenderer`, which creates a React root inside the ProseMirror-managed DOM. This is the most common crash trigger.
- `packages/app/src/stores/blockStore.ts` — the Zustand store that drives re-renders on content change.

**Acceptance criteria:**
- [ ] \#1 Two clients on the same page: one edits a callout block, the observing client sees updated content with no console errors
- [ ] \#2 Two clients on the same page: one edits a plain text block, the observing client sees updated content
- [ ] \#3 Two clients on the same page: one creates/deletes/reorders blocks while the other observes, no crash
- [ ] \#4 Local editing, focus/blur, and lock badge behavior on the observing client are unaffected (no regression from NOT-40 fix)
- [ ] \#5 `bun --bun tsc --noEmit -p packages/app` passes

**Out of scope:**
- Yjs/CRDT-based operational transform (the content is replaced wholesale via SSE, not merged per-character)
- Auto-reconnect or connection resilience (EventSource handles drops)
- Performance optimization of the SSE or store path beyond what's needed to prevent the crash
---
<!-- COMMENTS:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Triage complete — moved to ready-for-agent. Bug confirmed and still present. Crash path: SSE block.updated → store write → React re-render → content-sync effect calls editor.commands.setContent() on unfocused editor → ProseMirror DOM rebuild desyncs ReactNodeViewRenderer (CalloutExtension) leading to insertBefore NotFoundError. Agent brief posted with fix strategy: break the store→re-render→setContent cycle, either by wiring onBlockUpdated to update the editor directly, or by deferring setContent beyond React's commit phase.
<!-- SECTION:FINAL_SUMMARY:END -->
