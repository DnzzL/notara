---
id: NOT-170
title: Une page renommée par l'API reste introuvable sous son nouveau titre
status: done
assignee: []
created_date: 2026-10-29 20:43
updated_date: '2026-11-12T20:49:00Z'
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
- [x] #1 A page renamed through REST or RPC is found by search under its new title
- [x] #2 A test covers it through the REST door
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Not reproducible on current main: migration 022 (NA-2, #39) added the missing pages_au UPDATE trigger, so REST/RPC renames (both go through Pages.updatePage) are indexed. Added a REST regression test: rename then search finds new title, not old. Verified it fails when the trigger is disabled, passes with it. No source change.
<!-- SECTION:FINAL_SUMMARY:END -->
