---
id: NOT-121
title: Delete the pass-through modules
status: ready-for-agent
assignee: []
created_date: '2026-08-26 11:13'
labels:
  - enhancement
dependencies: []
priority: low
ordinal: 116000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Housekeeping pass over modules that fail the deletion test — deleting them concentrates nothing, because they hold nothing.

The auth client is twelve lines of pure re-export. The import-export handler module has five exports, four of which are one-line re-exports; only the archive unwrapping earns its place. The rate-limit middleware computes an allowed-origin value that nothing reads.

One of them is not a deletion but a deepening: the error reporter takes an Error, so eight of its nine call sites in the server entry point are the same stanza wrapping a cause into a synthetic Error and losing the cause in the process. Have it take the cause directly.

Keep this surgical. Do not remove pre-existing dead code beyond the items named here.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The re-export-only modules are deleted and their callers import the real source directly
- [ ] #2 The unused computed value in the rate-limit middleware is gone
- [ ] #3 The error reporter accepts a cause, and the repeated wrapping stanza is removed from every call site
- [ ] #4 Error reports still reach the analytics backend with their original cause preserved
- [ ] #5 Both type-check commands pass and the server test suite is green
<!-- AC:END -->
