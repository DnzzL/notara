---
id: NOT-190
title: 'Block nesting: undo of a delete restores the subtree'
status: needs-triage
assignee: []
created_date: '2026-11-11T23:01:00Z'
labels:
  - bug
dependencies: []
priority: low
ordinal: 163000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Deleting a parent cascades to its children (NOT-140 slice 1), but the history entry only records the parent block, so undo brings back the parent alone.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Undoing the deletion of a block restores its descendants with their parent links
<!-- AC:END -->
