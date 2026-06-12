---
id: NOT-2
title: 'B-002: reorderPages RPC handler skips authentication'
status: ready for agent
assignee: []
created_date: '2026-06-12 13:55'
updated_date: '2026-06-12 14:05'
labels:
  - bug
dependencies: []
references:
  - 'packages/server/src/rpc-handlers.ts:61'
priority: high
ordinal: 2000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The reorderPages handler is the only RPC handler that uses withWorkspaceDb directly instead of withAuthedWorkspace. Any HTTP request with a valid X-Workspace-Id header can reorder pages without being logged in.\n\nFile: packages/server/src/rpc-handlers.ts:61\nFix: Replace withWorkspaceDb with withAuthedWorkspace and add page-permission check.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Unauthenticated request with valid X-Workspace-Id returns 401/403
- [x] #2 Authenticated workspace member can reorder pages
- [x] #3 bun --bun tsc --noEmit -p packages/server passes
- [x] #4 bun test packages/server/test passes
<!-- AC:END -->
