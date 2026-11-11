---
id: NOT-184
title: API keys scoped to a page subtree
status: ready-for-agent
assignee: []
created_date: '2026-11-11T13:21:00Z'
updated_date: '2026-11-11T22:05:00Z'
labels:
  - enhancement
milestone: m-5
dependencies: []
priority: high
ordinal: 157000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Why: giving an agent a key means giving it the whole workspace. A key limited to one page subtree ('root page', distinct from the existing read/write scope) lets people hand an agent just the project it works on.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A key can be created with a root page; it is stored with that scope
- [x] #2 Moving a page in or out of the subtree changes access accordingly, tested
- [x] #3 Existing unscoped keys keep working unchanged
- [x] #4 A key limited to root page X cannot read or write anything outside X's subtree through any REST/MCP operation (pages, blocks, records, search, backlinks, export, templates), enforced in one place and tested
- [ ] #5 A subtree-limited key receives no change event from outside its subtree (needs NOT-183)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
AC #5 left unchecked: needs NOT-183 (change events).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Keys can be created with a root page (RPC createApiKey + key UI). Enforced in the operation seam: acl.ts KeyRoot rule + filterPagesByPermission + parentId placement check; members/admin refused. ADR-012. Tests: test/key-subtree.test.ts. AC5 depends on NOT-183.
<!-- SECTION:FINAL_SUMMARY:END -->
