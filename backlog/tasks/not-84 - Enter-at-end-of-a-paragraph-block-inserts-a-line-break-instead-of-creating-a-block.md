---
id: NOT-84
title: >-
  Enter at end of a paragraph block inserts a line break instead of creating a
  block
status: needs-triage
assignee: []
created_date: '2026-08-04 14:59'
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
- [ ] #1 Confirmed or ruled out by manual reproduction in the browser
- [ ] #2 If confirmed: Enter at the end of a paragraph creates a new block, Shift+Enter inserts a line break, and a spec covers it
<!-- AC:END -->
