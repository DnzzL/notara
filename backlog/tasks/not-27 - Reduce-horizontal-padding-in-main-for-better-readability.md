---
id: NOT-27
title: Reduce horizontal padding in main for better readability
status: done
assignee:
  - '@thomas'
created_date: '2026-06-17 09:51'
updated_date: '2026-06-17 09:59'
labels:
  - ui
  - enhancement
dependencies: []
references:
  - packages/app/src/styles.css
priority: low
ordinal: 32000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The main content area currently has padding: 40px 52px (104px total horizontal padding). On a typical editor width this leaves a narrow reading column with excessive whitespace on both sides. Reducing the padding will improve readability by allowing content to breathe at a more natural line length.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Desktop .main horizontal padding is reduced from 52px to a more readable value (e.g. 36-40px)
- [x] #2 Mobile breakpoint override still applies correctly
- [x] #3 .main.wide variant padding is also adjusted proportionally
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. In packages/app/src/styles.css: Change .main padding from 40px 52px to 40px 40px\n2. Change .main.wide padding from 24px 28px to 24px 24px\n3. Verify mobile breakpoint @media (max-width: 880px) override still applies correctly
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- Changed .main padding from 40px 52px to 40px 40px (reduced from 104px total to 80px)

- Changed .main.wide padding from 24px 28px to 24px 24px (proportionally adjusted)

- Mobile breakpoint at @media (max-width: 880px) still correctly overrides with 16px 12px
<!-- SECTION:NOTES:END -->
