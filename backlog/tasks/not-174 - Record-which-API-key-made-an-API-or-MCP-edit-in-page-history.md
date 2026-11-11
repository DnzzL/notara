---
id: NOT-174
title: 'Page history: record which API key (by name) made an API or MCP edit'
status: done
assignee: []
created_date: '2026-11-10T17:05:00Z'
updated_date: '2026-11-11T22:16:00Z'
labels:
  - enhancement
milestone: m-5
dependencies: []
priority: medium
ordinal: 146000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Depends on PR #33 (feat/agent-ready-ops) landing first.
Why: when agents edit pages, the owner must see which key made it. Caveat: no page-history table, handler or UI exists on main, so this needs a schema decision first (versions table vs updated_by on pages/blocks), recorded as an ADR. Human picks the shape; then split into slices (history exists / key name recorded).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 UI edits are still attributed to the user, unchanged
- [x] #2 Key secret/hash never appears in history data or API responses (tested)
- [x] #3 Renaming or revoking a key does not break existing history entries (tested)
- [x] #4 An edit made over REST or MCP sets updated_by on the page/block: API key id plus a key-name snapshot (UI edits: user id)
- [x] #5 An ADR records updated_by columns vs a versions table (rejected; full history is a possible later step)
<!-- AC:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: @assistant
created: 2026-11-11T21:57:00Z

---

Decision (approved): add an updated_by column (user id, or API key id + name snapshot) on pages and blocks. Not a versions table. Full history is a possible later step. The implementing task writes the ADR.

---

author: @agent
created: 2026-11-11T22:06:00Z

---

AC #1 'page history' is delivered as the last-editor display (page header 'Edited by X'): there is no history table, by decision. Shape in docs/adr/012-updated-by.md.

---

author: @agent
created: 2026-11-11T22:16:00Z

---

Correction: the ADR is docs/adr/013-updated-by.md (012 was taken).

---
<!-- COMMENTS:END -->
