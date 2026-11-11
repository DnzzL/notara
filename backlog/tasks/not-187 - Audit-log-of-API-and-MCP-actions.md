---
id: NOT-187
title: Audit log of API and MCP actions
status: ready-for-agent
assignee: []
created_date: '2026-11-11T13:21:00Z'
updated_date: '2026-11-11T23:04:00Z'
labels:
  - enhancement
milestone: m-5
dependencies:
  - NOT-174
priority: medium
ordinal: 160000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Why: once agents write through keys, owners need to see what each key did. Builds on NOT-174 (which key made an edit in page history). Needs a human choice: what is logged, where it is stored, retention, who can read it.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Every API/MCP mutation is recorded with key name, operation, target and time
- [x] #2 Workspace owners can list the log, filtered by key
- [x] #3 Retention of the log is defined and enforced
- [x] #4 No secret or page content is written to the log
- [x] #5 An ADR settles storage, retention and who can read the log before the build (updated_by keeps only the last editor, so the log needs its own store)
<!-- AC:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: @assistant
created: 2026-11-11T21:57:00Z

---

Decision (approved): audit log, built on NOT-174 (updated_by). Depends on NOT-174 landing first.

---
<!-- COMMENTS:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Audit log of API-key writes: append-only audit_log table per workspace (migration 024, ADR-015), written in runOperation (REST+MCP), owner-only listAuditLog RPC filterable by key, list in workspace settings. Retention AUDIT_LOG_RETENTION_DAYS (default 90) enforced by the daily sweep. Ids only: no secret, no content. Tests: mcp.test.ts (audit log), audit-retention.test.ts.
<!-- SECTION:FINAL_SUMMARY:END -->
