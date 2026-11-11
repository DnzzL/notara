---
id: NOT-174
title: 'Page history: record which API key (by name) made an API or MCP edit'
status: ready-for-human
assignee: []
created_date: '2026-11-10T17:05:00Z'
updated_date: '2026-11-11T13:21:00Z'
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
- [ ] #1 An edit made over REST or MCP appears in page history labelled with the API key name
- [ ] #2 UI edits are still attributed to the user, unchanged
- [ ] #3 Key secret/hash never appears in history data or API responses (tested)
- [ ] #4 Renaming or revoking a key does not break existing history entries (tested)
<!-- AC:END -->
