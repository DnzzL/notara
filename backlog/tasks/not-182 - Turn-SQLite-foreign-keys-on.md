---
id: NOT-182
title: Turn SQLite foreign keys on
status: ready-for-agent
assignee: []
created_date: '2026-11-11T13:21:00Z'
updated_date: '2026-11-11T21:58:00Z'
labels:
  - bug
milestone: m-4
dependencies:
  - NOT-112
priority: high
ordinal: 155000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Why: CLAUDE.md §7 known debt: the FK pragma is OFF, so ON DELETE CASCADE never fires and hard-deletes must remove children by hand. Enabling it is a data-risk migration (existing orphan rows can make writes fail) and needs an ADR before execution, with the rejected alternative recorded.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 An ADR records the decision and the rejected alternative
- [ ] #2 Hard-deletes still remove all children
- [ ] #3 The full server test suite passes with the pragma on
- [ ] #4 The migration reports orphan rows; the DB opener sets PRAGMA foreign_keys=ON on every connection (the pragma is per-connection and a no-op inside a transaction)
<!-- AC:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: @assistant
created: 2026-11-11T21:57:00Z

---

Decision (approved): the migration first reports orphan rows, then enables PRAGMA foreign_keys=ON; ADR required. Start only after NOT-112 is closed (its last open item is AC #5).

---
<!-- COMMENTS:END -->
