---
id: NOT-127
title: Does the todo markdown shortcut actually work?
status: needs-triage
assignee: []
created_date: '2026-08-27 15:30'
labels:
  - bug
dependencies: []
priority: medium
ordinal: 122000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Typing "[] " or "[ ] " at the start of an empty block should turn it into a todo — that is what the input rule in BlockEditor.tsx registers, matching /^(?:\[\]|\[ \])\s$/.

Under Playwright neither form produces a task list. The block stays a paragraph: no checkbox renders and no taskItem attribute appears. Found while writing the NOT-96 regression tests, where a test that looked like it covered the todo split was in fact exercising the paragraph branch and asserting nothing about todos. It was removed rather than left in place looking like coverage.

What is NOT known, and is the whole question: whether this fails for a real user too, or only under synthetic typing. pressSequentially dispatches per-character key events, and a ProseMirror input rule can be sensitive to how the text arrives — so this may be a test-harness artifact rather than a product defect. No E2E has ever created a todo, so there is no prior art either way.

Worth five minutes of manual checking before deciding it is a bug: open a page, type "[] " on an empty line, see whether a checkbox appears. If it does, this is about how to drive the editor from a test. If it does not, users cannot make todos by typing and that is considerably more serious than a test gap.

Consequence either way: the todo half of the NOT-96 fix has no automated coverage. The list half does.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Established by manual check whether the shortcut works for a real user
- [ ] #2 If it is a product defect, typing the shortcut creates a todo
- [ ] #3 If it is a harness artifact, the todo split has an e2e that genuinely exercises the todo branch
<!-- AC:END -->
