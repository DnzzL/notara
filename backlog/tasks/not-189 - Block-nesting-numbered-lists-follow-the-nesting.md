---
id: NOT-189
title: 'Block nesting: numbered lists follow the nesting'
status: needs-triage
assignee: []
created_date: '2026-11-11T23:01:00Z'
labels:
  - enhancement
dependencies: []
priority: low
ordinal: 162000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
NOT-140 slice 1 indents nested blocks but computeNumberedRunIndices still numbers the flat list. Numbering should restart per level.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A nested numbered list restarts at 1 under its parent
<!-- AC:END -->
