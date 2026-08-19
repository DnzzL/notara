---
id: NOT-84
title: >-
  Enter at end of a paragraph block inserts a line break instead of creating a
  block
status: done
assignee:
  - '@claude'
created_date: '2026-08-04 14:59'
updated_date: '2026-08-19 12:49'
labels:
  - bug
dependencies: []
priority: medium
ordinal: 72000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Observed while driving the E2E multiuser specs: focusing a paragraph block, pressing End then Enter and typing produced '<p>Gamma<br>Delta from bob</p>' — one block with a hard break — instead of a new sibling block. Expected Notion-like behaviour is Enter creating a block and Shift+Enter inserting the line break. Observed through Playwright's synthetic key events, so confirm by hand before acting: it may be an artefact of how the keypress is delivered rather than real editor behaviour. Discovered during NOT-78; not covered by a spec.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Confirmed or ruled out by manual reproduction in the browser
- [x] #2 If confirmed: Enter at the end of a paragraph creates a new block, Shift+Enter inserts a line break, and a spec covers it
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Confirm the report is real editor behaviour, not a Playwright artefact
2. Route paragraph Enter through the existing split-paragraph behaviour
3. Cover end-split, mid-split and Shift+Enter with an e2e spec
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- Confirmed, and not a synthetic-key artefact: the Enter handler's fallback arm calls setHardBreak() for every block whose splitBehavior is "normal", and paragraph was "normal". The behaviour is in the source, and the new e2e spec reproduces it in a real browser.
- Fix is one line of config: paragraph's splitBehavior becomes "split-paragraph", the arm heading/quote already use. For a paragraph, splitToParagraphAtCursor wraps the head in <p> and the tail in a new paragraph, which is exactly the wanted split — no new branch needed.
- Shift+Enter already inserted a hard break, so it becomes the line-break key without changes. Code blocks keep Enter-as-newline: their splitBehavior stays "normal".
- Mid-text splits then duplicated the line into both blocks: the editor's pending debounced save still held the pre-split content and landed after splitBlock. Fixed with setContent(before, false) before the split (emitUpdate=false, so no further save is queued). This also fixes headings and quotes, which shared the branch.
- The list and todo branches carry the same race; filed as NOT-96 rather than widened here.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Enter at the end of a paragraph inserted a hard break instead of creating a block, so a page written with Enter ended up as one block full of <br>. Every other block type already split. Confirmed in the source (the Enter handler's fallback arm calls setHardBreak for splitBehavior "normal", which paragraph was) and reproduced in a browser.

Changes:
- packages/app/src/components/blockTypes.ts: paragraph's splitBehavior is now "split-paragraph" — the same arm heading and quote use, which for a paragraph produces exactly the wanted head/tail split. Shift+Enter keeps its hard break, so it becomes the line-break key. Code blocks are untouched (still "normal", so Enter adds a line).
- packages/app/src/components/BlockNavigationExtension.ts: truncate the current editor to the head half before splitting. Without it the block's pending debounced save landed after the split and restored the whole line, leaving the text in both blocks. Also fixes headings and quotes, which shared the branch.
- e2e/editor-enter.spec.ts: end-of-paragraph split, mid-text split, and Shift+Enter staying in one block with a single <br>.

Tests: the new spec passes 3x in a row; full chromium (37) and multiuser (27) e2e suites green; bun run test green.

Follow-up: NOT-96 — the list and todo mid-text branches still carry the same debounced-save race.

Supersedes the paragraph half of NOT-55's "heading/quote/paragraph -> normal (soft break, unchanged)" decision.
<!-- SECTION:FINAL_SUMMARY:END -->
