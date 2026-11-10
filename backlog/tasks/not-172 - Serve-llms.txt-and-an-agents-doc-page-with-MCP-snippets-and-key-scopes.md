---
id: NOT-172
title: Serve llms.txt and an agents doc page with MCP snippets and key scopes
status: ready-for-agent
assignee: []
created_date: '2026-11-10T17:05:00Z'
updated_date: '2026-11-10T17:07:00Z'
labels:
  - enhancement
milestone: m-0
dependencies: []
priority: medium
ordinal: 144000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Depends on PR #33 (feat/agent-ready-ops: typed operation table behind REST, OpenAPI, MCP, CLI) landing first.
Why: agents discover a service via /llms.txt; humans need copy-paste MCP setup.
Agent brief: serve /llms.txt from the app (generated from the operation table, no hand-kept list) pointing to OpenAPI, /mcp and the agents doc page. Doc page covers MCP connection snippets for Claude Code and Cursor, and API key scopes (read / write). No LLM calls in the app.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 GET /llms.txt returns text/plain listing OpenAPI URL, MCP URL and the agents page, without auth
- [ ] #2 Agents doc page has working MCP snippets for Claude Code and Cursor
- [ ] #3 Agents doc page explains key scopes (read vs write) and which operations each allows
- [ ] #4 A test asserts /llms.txt content type and that it references the OpenAPI and MCP endpoints
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Prior art: an earlier /llms.txt shipped as NOT-164 (81e023f, af26134) and was reverted in da389bc. Gotcha fixed in af26134: the static app served index.html at /llms.txt. Back now because it is generated from the operation table.
<!-- SECTION:NOTES:END -->
