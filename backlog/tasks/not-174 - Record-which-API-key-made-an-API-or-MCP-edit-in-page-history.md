---
id: NOT-174
title: Record which API key made an API or MCP edit in page history
status: ready-for-agent
assignee: []
created_date: '2026-11-10T17:05:00Z'
labels:
  - enhancement
milestone: m-0
dependencies: []
priority: medium
ordinal: 146000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Depends on PR #33 (feat/agent-ready-ops: typed operation table behind REST, OpenAPI, MCP, CLI) landing first.
Why: when agents edit pages, the owner must see which key (by name) did it.
Agent brief: carry the API key name in the operation context; store it as the actor on page history entries and block edits made via REST/MCP; show it in the history UI. Never store the key secret, only its name; UI edits keep the user as actor.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 An edit made over REST or MCP appears in page history labelled with the API key name
- [ ] #2 UI edits are still attributed to the user, unchanged
- [ ] #3 Key secret/hash never appears in history data or API responses (tested)
- [ ] #4 Renaming or revoking a key does not break existing history entries (tested)
<!-- AC:END -->
