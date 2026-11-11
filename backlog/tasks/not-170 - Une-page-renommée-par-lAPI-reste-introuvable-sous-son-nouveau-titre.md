---
id: NOT-170
title: Une page renommée par l'API reste introuvable sous son nouveau titre
status: needs-triage
assignee: []
created_date: '2026-10-29 20:43'
labels:
  - bug
dependencies: []
priority: medium
ordinal: 150000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Seen while writing the REST tests for NOT-169.3 (not investigated): after PATCH /pages/:id with a new title, search with the new title does not return the page. Probably the search index is not updated on a title change through that path. Check whether the app's rename (RPC) has the same gap.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A page renamed through REST or RPC is found by search under its new title
- [ ] #2 A test covers it through the REST door
<!-- AC:END -->
