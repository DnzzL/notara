---
id: NOT-182
title: Turn SQLite foreign keys on
status: ready-for-human
assignee: []
created_date: '2026-11-11T13:21:00Z'
labels:
  - bug
milestone: m-4
dependencies: []
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
- [ ] #2 A migration finds and reports orphan rows before the pragma is enabled
- [ ] #3 Hard-deletes still remove all children
- [ ] #4 The full server test suite passes with the pragma on
<!-- AC:END -->
