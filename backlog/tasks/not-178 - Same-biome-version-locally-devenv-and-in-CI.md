---
id: NOT-178
title: >-
  bunx biome fetches latest 2.6.x when node_modules is missing; BoardView hook
  factories
status: ready-for-agent
assignee: []
created_date: '2026-11-10T18:10:00Z'
updated_date: '2026-11-10T18:14:00Z'
labels:
  - bug
dependencies: []
priority: medium
ordinal: 143000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Not a devenv drift: devenv lock and nixpkgs rolling both give biome 2.5.15, same minor as package.json/bun.lock 2.5.6; bun lint passes with and without BIOME_BINARY. The 2.6.6 seen in NA-5 came from a worktree without node_modules (backlog-only task): bunx @biomejs/biome fetched latest instead of the locked version. Version pins unchanged. Real fix kept: SortableColumn/SortableCard were components defined inside BoardView (remounted every render, losing drag/DOM state; flagged by 2.6 noComponentHookFactories); hoisted to module level with props.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 bun lint passes with BIOME_BINARY set and with it unset
- [ ] #2 Board view still drags columns and cards
<!-- AC:END -->
