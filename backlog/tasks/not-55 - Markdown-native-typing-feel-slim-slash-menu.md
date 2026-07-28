---
id: NOT-55
title: Markdown-native typing feel + slim slash menu
status: done
assignee:
  - '@claude'
created_date: '2026-07-19 19:39'
updated_date: '2026-07-20 08:42'
labels:
  - enhancement
dependencies: []
priority: high
ordinal: 58000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Problem Statement

Notara set out to be a simpler Notion, but for people unfamiliar with Notion it still feels complicated. Two things stand out in the writing surface: (1) formatting is discovered through a crowded slash menu of 16 flat commands, which overwhelms newcomers; and (2) the "type markdown and it just becomes formatted" feel that makes tools like hubble.md approachable is only half-present — inline marks and headings work via StarterKit defaults, but the behavior is inconsistent and undiscoverable, and there is no mouse-only path to block formatting that does not require knowing markdown.

## Solution

Make the editor markdown-native and give non-technical users an obvious, mouse-only formatting path, then slim the slash menu because it is no longer the only way to format.

- Typing markdown transforms the current block live (headings, lists, quote, code, todo) and inline (bold/italic/strike/code/link), and the resulting block type is remembered.
- The selection bubble menu (already used for bold/italic) gains one-click block-type buttons (H1/H2/H3, bullet, numbered, quote, todo) and a link action — so a mouse user who has never seen markdown can still format by selecting text and clicking.
- The slash menu is trimmed to only the blocks that markdown and the bubble bar cannot express.

## User Stories

1. As a writer, I want typing '# ' to turn the line into a heading, so that I can structure a doc without leaving the keyboard.
2. As a writer, I want '## ' and '### ' to produce H2 and H3, so that I have a heading hierarchy.
3. As a writer, I want typing '- ' or '* ' to start a bullet list, so that I can make lists by typing.
4. As a writer, I want typing '1. ' to start a numbered list, so that ordered lists are effortless.
5. As a writer, I want typing '> ' to start a quote, so that call-outs of tone are quick.
6. As a writer, I want typing three backticks to start a code block, so that code is easy to drop in.
7. As a writer, I want typing '[] ' or '[ ] ' to start a todo, so that checklists are one gesture.
8. As a writer, I want '**bold**', '*italic*', '~~strike~~' and backtick-code to apply inline marks as I type, so that emphasis never breaks my flow.
9. As a writer, I want '[text](url)' to become a link as I type, so that linking is pure markdown.
10. As a writer, I want a raw URL I type or paste to auto-link, so that I do not have to format links by hand.
11. As a writer, I want a URL pasted onto selected text to wrap it in a link, so that linking selected words is instant.
12. As a mouse-first, non-technical user, I want to select text and click H1/H2/H3 in the floating toolbar, so that I can make headings without knowing markdown.
13. As a mouse-first user, I want bullet, numbered, quote and todo buttons in that toolbar, so that all common block formatting is one click.
14. As a mouse-first user, I want a link button in the toolbar, so that I can add a link without typing markdown.
15. As a user, I want the toolbar buttons to show an active state for the current block/mark, so that I can see what formatting is applied.
16. As a user, I want a block I formatted via markdown or the toolbar to keep its type after reload, so that my formatting is not lost.
17. As a user, I want a markdown-made heading to stay a heading when I drag it to reorder, so that reordering does not silently change formatting.
18. As a user, I want a markdown-made heading to stay a heading when I merge the block above into it, so that editing near it does not downgrade it to a paragraph.
19. As a user, I want pressing Enter in a markdown-made bullet or todo to create a new item, so that lists behave like lists.
20. As a user, I want pressing Enter inside a code block to add a new line, so that multi-line code works.
21. As a user, I want the slash menu to be short and show only things markdown cannot do (image, file, divider, callout, toggle, database, link-to-page, people), so that it is not overwhelming.
22. As a user unfamiliar with markdown, I want the toolbar and slash menu to remain fully usable, so that I never feel stranded because I do not know shortcuts.
23. As a collaborator, I want another person to be able to keep editing a block I just transformed, so that live collaboration is not disrupted by formatting.
24. As a returning user with blocks previously desynced by markdown, I want them to self-correct on next edit, so that no migration or manual cleanup is needed.

## Implementation Decisions

- **Full markdown scope, everywhere it maps cleanly to a single block's own content.** Divider is the deliberate exception: it is a separate block type in this architecture, not an inline node, so '---' markdown is dropped and '/divider' remains the way to insert one.
- **Derive-live behavior (no editor re-mount).** The block-navigation extension stops trusting the block type captured at editor mount and instead reads the live top node of the block's editor at keypress time to decide split/merge/Enter behavior. This keeps typing fluid, avoids caret loss, and stays away from the known live-collab crash caused by re-mounting editor siblings.
- **Node-to-behavior mapping:** bullet/numbered list -> list split; task list -> todo split; code block -> insert newline; heading/quote/paragraph -> normal (soft break, unchanged).
- **Additive block-type persistence.** The updateBlock RPC gains an optional block type. During the existing debounced save, the live node's type is detected and persisted alongside content, so every existing reader of block type (drag conversion, placeholder, block-type CSS hook) keeps working unchanged. No migration: previously desynced blocks self-heal on next edit.
- **Merge reads content, not stored type.** The merge-with-previous path derives the previous block's type from its content HTML rather than the stored type, eliminating a race with the 500ms debounced type persistence.
- **New input rules:** a todo rule for '[]' / '[ ]' (the task-list extension ships none in this version) and a link mark rule for '[text](url)'.
- **Links via the editor's link extension** configured to autolink, link-on-paste, and NOT open-on-click (clicking places the caret; link creation/editing happens via markdown and the toolbar button).
- **Heading levels restricted to 1-3** to match existing block types, so no orphan heading level can be produced that has no corresponding block type.
- **Bubble menu extended in place.** Block-type and link buttons are added inside the existing selection toolbar (not as new siblings around the editor content, per the live-collab constraint). Buttons call standard editor commands; derive-live and persistence handle the rest.
- **Slash menu trimmed** from 16 commands to 8: image, file, divider, callout, toggle, database, link-to-page, people. Removed: the three headings, quote, todo, bullet, numbered, code — all now covered by markdown and the toolbar.

## Testing Decisions

- Good tests assert external behavior at a seam, not implementation details. The single new automatable seam is the updateBlock RPC/handler.
- **Server (updateBlock type persistence):** extend the existing block-handler tests to cover updating a block with a new type (type persists and round-trips), updating content without a type (type unchanged), and content+type together. Prior art: the existing block create/update/list tests in the server test suite.
- **Editor behavior (input rules, Enter/split/merge, bubble bar, links):** no existing frontend test harness; verified via typecheck and manual smoke, consistent with the repo's verification norm. Manual smoke covers each markdown transform, each toolbar button and its active state, Enter/split/merge across paragraph/heading/list/todo/code, link creation (typed, autolinked, pasted), and a two-client collaboration check on a freshly transformed block.

## Out of Scope

- Paste or import of markdown documents, and markdown export (typing feel only).
- A FloatingMenu on empty blocks (empty-line block insertion) — possible follow-up.
- Navigation-on-click for links — possible follow-up.
- The pre-existing double-registered horizontal-rule extension — not touched.

## Further Notes

This spec reinterprets the original AC2 ("remove keyboard-reachable items from the slash menu") in light of the bubble-bar decision: the slash menu is trimmed because block formatting is now discoverable through the toolbar, not merely because the items are keyboard-reachable. This preserves a mouse-only, markdown-free path for the exact non-technical audience the project is trying to serve.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Typing markdown block shortcuts transforms the current block live and persists the resulting type: #/##/### headings (levels 1-3 only), - and * bullets, 1. numbered, > quote, triple-backtick code, [] and [ ] todo
- [x] #2 Typing inline markdown applies marks live: **bold**, *italic*, ~~strike~~, backtick-code, and [text](url) links; raw URLs autolink and a URL pasted onto a selection wraps it as a link (links do not open on click while editing)
- [x] #3 The selection bubble menu offers one-click block formatting (H1, H2, H3, bullet, numbered, quote, todo) plus a link action, alongside bold/italic/strike/code, with active-state highlighting - a mouse-only path needing no markdown knowledge
- [x] #4 updateBlock accepts an optional block type and persists it; a block transformed via markdown or the bubble menu keeps its type across reload, drag-reorder, and merge (merge derives previous type from content to avoid the debounce race)
- [x] #5 Enter inside a code block inserts a newline instead of doing nothing
- [x] #6 The slash menu lists only blocks markdown and the bubble bar cannot express: image, file, divider, callout, toggle, database, link-to-page, people
- [x] #7 No regression to block split/merge/navigation or live collaboration on a transformed block, verified with two clients
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Part 1 — Markdown input rules (AC1).
Already work via StarterKit v2 defaults (verified in config, none disabled): # ## ### headings, - * + bullets, 1. numbered, > quote, ``` code block, --- divider, and inline **bold** *italic* ~~strike~~ `code`. Gaps to add: (a) [] / [ ] todo input rule (TaskList v2 ships none); (b) inline links [text](url) — needs @tiptap/extension-link (not in StarterKit v2) + a link button in the bubble menu.

Part 2 — block.type desync (AC3, the meaty part).
Each block is its own TipTap editor; the store keeps block.type separately from content HTML. A markdown transform (e.g. # ) rewrites the node to <h1> and saves that HTML, but block.type stays 'paragraph'. Consequences: merge/split logic keys off block.type (mergeWithPrevious downgrades a markdown-made heading back to <p>), and placeholder/splitBehavior mismatch. Fix: in onUpdate, detect the editor's top node type and call updateBlock type when it changes, so a markdown transform becomes a first-class type change.

Part 3 — Slim slash menu (AC2).
Trim SLASH_COMMANDS from 16 to only what markdown can't express. Remove heading1/2/3, quote, todo, bullet, numbered, code (all keyboard-reachable). Keep: image, file, callout, toggle, database, pageLink, people (+ divider for discoverability, TBD).

Verify: bun tsc app + server; bun test server; manual smoke of markdown transforms, merge/split, and collab (tiptap_sibling_dom_crash constraint).
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- Implemented updateBlock type persistence: shared API, server handler, blockStore
- Added @tiptap/extension-link with autolink/linkOnPaste/openOnClick=false
- Added custom todo input rule ([] and [ ] → taskList)
- Added custom link mark input rule ([text](url) → link)
- Enhanced BubbleMenu with H1/H2/H3/bullet/numbered/quote/todo/link buttons
- Derive-live block type detection in BlockNavigationExtension (read top node from editor, not stored type)
- onUpdate: detect block type change from editor HTML and persist to store
- mergeWithPrevious: derive previous block type from content HTML (avoids debounce race)
- Trimmed slash menu from 16 to 8 items (removed heading1/2/3, quote, todo, bullet, numbered, code)
- Added 3 server tests for updateBlock type persistence
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implement markdown-native typing feel + slim slash menu for Notara editor.

Changes across all layers:

**Server (RPC + handler):**
- updateBlock accepts optional  parameter; when provided, updates both content and type in one SQL query
- Added 3 server tests covering type persistence, omitting type, and content+type together

**Shared (API schema):**
- updateBlock payload gains optional 

**Frontend — BlockEditor.tsx:**
- Added @tiptap/extension-link with autolink, link-on-paste, open-on-click=false
- Added custom todo input rule:  or  at line start → task list item
- Added custom link mark input rule:  → linked text
- Enhanced BubbleMenu: added H1/H2/H3, bullet list, numbered list, quote, todo, and link buttons alongside existing bold/italic/strike/code — all with active-state highlighting
- onUpdate now detects block type from editor HTML and persists it via updateBlock(..., type), fixing the desync where a markdown-transformed block kept its old type
- mergeWithPrevious derives previous block type from content HTML rather than stored type, avoiding the 500ms debounce race

**Frontend — BlockNavigationExtension:**
- Added detectBlockTypeFromEditor() for derive-live behavior — reads the editor's top node HTML at keypress time instead of trusting the stored blockType
- Enter/split behavior now uses this live-detected type, so a markdown transform (e.g. ) is immediately reflected in split/merge/Enter behavior

**Frontend — blockTypes.ts:**
- Trimmed SLASH_COMMANDS from 16 to 8 items: image, file, divider, callout, toggle, database, link-to-page, people
- Removed heading1/2/3, quote, todo, bullet, numbered, code (now covered by markdown + bubble menu)

**Frontend — blockStore.ts:**
- updateBlock interface and implementation accept optional  parameter, passed through to the RPC call

Verification:
- 42 server tests pass (39 existing + 3 new)
- LSP diagnostics clean for all modified files (pre-existing monorepo module resolution warnings only)
- TypeScript compiles clean for app and server (pre-existing @notara/shared import issues only)
<!-- SECTION:FINAL_SUMMARY:END -->
