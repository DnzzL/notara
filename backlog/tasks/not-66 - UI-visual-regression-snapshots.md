---
id: NOT-66
title: UI visual regression snapshots
status: ready-for-agent
assignee: []
created_date: '2026-07-28 14:52'
updated_date: '2026-07-28 14:53'
labels:
  - enhancement
dependencies:
  - NOT-63
ordinal: 69000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add Playwright visual snapshot tests for the block editor, database table view, board view, and sidebar. Use toMatchSnapshot to catch pixel-diffs. CI fails on any visual regression. Catches the class of visual-continuity bugs agents could introduce (like NOT-58, NOT-59).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Snapshot test for block editor (with typed content)
- [ ] #2 Snapshot test for database table view (with sample data)
- [ ] #3 Snapshot test for board view (with sample data)
- [ ] #4 Snapshot test for sidebar with nested pages
- [ ] #5 CI fails if any screenshot differs from baseline
<!-- AC:END -->
