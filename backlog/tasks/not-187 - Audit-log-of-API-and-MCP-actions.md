---
id: NOT-187
title: Audit log of API and MCP actions
status: ready-for-agent
assignee: []
created_date: '2026-11-11T13:21:00Z'
updated_date: '2026-11-11T21:58:00Z'
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
- [ ] #1 Every API/MCP mutation is recorded with key name, operation, target and time
- [ ] #2 Workspace owners can list the log, filtered by key
- [ ] #3 Retention of the log is defined and enforced
- [ ] #4 No secret or page content is written to the log
- [ ] #5 An ADR settles storage, retention and who can read the log before the build (updated_by keeps only the last editor, so the log needs its own store)
<!-- AC:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: @assistant
created: 2026-11-11T21:57:00Z

---

Decision (approved): audit log, built on NOT-174 (updated_by). Depends on NOT-174 landing first.

---
<!-- COMMENTS:END -->
