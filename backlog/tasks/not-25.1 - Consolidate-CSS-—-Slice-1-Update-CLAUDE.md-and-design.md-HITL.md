---
id: NOT-25.1
title: 'Consolidate CSS — Slice 1: Update CLAUDE.md and design.md (HITL)'
status: ready for agent
assignee: []
created_date: '2026-06-16 16:34'
labels:
  - enhancement
dependencies: []
parent_task_id: NOT-25
priority: high
ordinal: 26000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Update CLAUDE.md and docs/design-system.md to document the Tailwind v4 consolidation approach. After this slice, both files should clearly state: styles.css is the Tailwind v4 setup layer only (imports, @theme inline, :root tokens, reset, keyframes); all component-specific styles use Tailwind v4 utility classes.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 CLAUDE.md updated with Tailwind v4 styling approach in the Architectural Map section
- [ ] #2 docs/design-system.md updated — first paragraph no longer points to styles.css as the source of truth for component CSS
- [ ] #3 Both files explicitly state: component styles use Tailwind v4 utilities, styles.css is Tailwind v4 setup only
<!-- AC:END -->
