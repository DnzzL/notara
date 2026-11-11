---
id: NOT-184
title: API keys scoped to a page subtree
status: ready-for-agent
assignee: []
created_date: '2026-11-11T13:21:00Z'
labels:
  - enhancement
milestone: m-5
dependencies: []
priority: high
ordinal: 157000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Why: giving an agent a key means giving it the whole workspace. A key limited to one page subtree lets people hand an agent just the project it works on.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A key can be created with a root page; it is stored with that scope
- [ ] #2 A key limited to page X cannot read or write pages, blocks or records outside X's subtree, tested over REST and MCP
- [ ] #3 Moving a page in or out of the subtree changes access accordingly, tested
- [ ] #4 Existing unscoped keys keep working unchanged
<!-- AC:END -->
