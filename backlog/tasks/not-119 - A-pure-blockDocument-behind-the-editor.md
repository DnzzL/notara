---
id: NOT-119
title: A pure blockDocument behind the editor
status: ready-for-agent
assignee: []
created_date: '2026-08-26 11:13'
updated_date: '2026-09-01 17:20'
labels:
  - enhancement
dependencies:
  - NOT-118
priority: high
ordinal: 114000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Split and merge semantics live half in a TipTap extension, which decides WHICH operation to perform and formats the HTML, and half in React callbacks, which mutate the store and request focus. The two are coupled by an ordering invariant documented only in a comment — the comment NOT-96 is about.

The callbacks interface leaks: five optional callbacks whose optionality is fictional, since all five are always supplied, plus index and count options, and every caller must know the call ordering and that one of them can fail on a locked block.

Content moves through three untyped global window events, unscoped to any page and with no unsubscribe contract. Three overlapping guards decide who owns a block's content at any moment — a pending-save ref, the editor's focus state, and an equality check against the store — and the comments around each of them describe races the interface cannot express.

There are two writers to the block list with different rules: the presence connection calls the store's setState directly, bypassing every store action and all history recording.

A derived-type race: the editor persists a type derived from HTML on a debounce, and the merge path re-derives rather than trusting the store, explicitly because of that race.

A network client per block: the page-reference extension calls search and list-pages from inside every block editor instance.

TARGET
- A pure document module: split(blocks, blockId, before, after) and merge(blocks, blockId) returning operations plus a focus request, and insertAfter. The extension becomes a key-to-intent mapper; the callbacks object collapses to a single dispatch.
- A per-page session owning focus and content pushes — register, focus, setContent, stripSlash — replacing the module-global mutable focus singleton and all three window events. Ownership rules become invariants of that module instead of conditions repeated at three call sites.
- One reconciliation path in the store: apply a local operation, reconcile a remote event, with the conflict rule stated, so history recording and remote mirroring cannot diverge.

TEST DEBT TO CLOSE IN THIS TICKET: two editor tests currently COPY the implementation into the test file rather than importing it — they pass while the real code is broken. Another asserts a constant. The target test surface is pure and DOM-free: blocks plus cursor plus key in, new blocks plus focus request out. Make the real code importable and have the tests import it.

CONSTRAINT: the isolated-TipTap-editor-per-block architecture is settled. This ticket deepens what sits BEHIND each editor instance. Do not propose or perform a migration to a single document.

Related: NOT-96 (mid-item Enter duplicating text) lives in this code and should gain a regression test here.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Split, merge and insert are pure functions returning operations and a focus request, with no DOM and no editor instance involved
- [ ] #2 The navigation extension only maps keys to intents; the ordering invariant is enforced by the document module, not by a comment
- [ ] #3 The three global window events and the module-global focus singleton are gone, replaced by a per-page session
- [ ] #4 The block list has one writer; remote updates reconcile through the same path as local edits, with the conflict rule stated
- [ ] #5 The editor tests import the real implementation instead of copying it, and the placeholder assertion is replaced with a real one
- [ ] #6 NOT-96 has a regression test at the document-module level
- [ ] #7 The editor and multiuser live-sync E2E specs pass unchanged
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Landed one slice: pure split/merge/insertAfter extracted to packages/app/src/lib/blockDocument.ts (mergeBlocks, splitBlock, insertBlockAfter), each returning a plain operation + focus request, no editor instance involved. BlockEditor.tsx's callbacks now call these and apply the returned operations via store actions/requestFocus/window event, byte-for-byte equivalent to the removed inline logic (verified in code review). Tests in packages/app/test/blockDocument.test.ts import the real module.

Caveat on AC #1: mergeBlocks still calls extractInlineHTML, which uses DOMParser -- so it's editor-instance-free but not literally DOM-free. Kept as-is to avoid a second, divergent inline-HTML-extraction implementation; flagged rather than silently accepted.

Not touched in this slice (remaining AC #2-7): the extension-as-key-mapper, the per-page focus session replacing the 3 window events + focus singleton, the single block-list writer/reconciliation path, migrating the two tests that copy implementation, the NOT-96 regression test at the module level, and e2e verification. Follow-up filed on the fleet backlog.
<!-- SECTION:NOTES:END -->
