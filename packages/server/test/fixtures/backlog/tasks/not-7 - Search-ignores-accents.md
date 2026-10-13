---
id: NOT-7
title: Search ignores accents
status: ready-for-agent
assignee:
  - '@dev'
created_date: '2026-06-02 10:00'
labels:
  - bug
dependencies:
  - NOT-3
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Users who type « creme » find none of the « crème » products.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A search test for creme is red on main
- [ ] #2 A query matches with or without accents
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Started with the FTS tokenizer.
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: @triage
created: 2026-06-03 09:00
---
Confirmed on main.
---

author: @dev
created: 2026-06-04 09:00
---
Which locale?
---
<!-- COMMENTS:END -->
