---
id: NOT-107
title: One block-content contract for both API surfaces
status: ready-for-agent
assignee: []
created_date: '2026-08-26 11:11'
labels:
  - bug
dependencies: []
priority: medium
ordinal: 102000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Block content is stored as a string by the blocks module. The REST adapter parses and stringifies JSON around it, so REST clients see structured content while RPC clients see the raw string. Same module, two contracts, decided by which door the caller came through.

The codec belongs inside the blocks module, not in one of its adapters. Move it there so both surfaces see one contract, and pick which contract that is — do not keep both alive behind a flag.

Also remove the duplicate page-id lookup for a block: handlers/blocks.ts declares one and the permissions module already exports the same thing.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Block content is encoded and decoded inside the blocks module, not in any adapter
- [ ] #2 RPC and REST callers observe the same block-content shape
- [ ] #3 The duplicated block-to-page lookup is reduced to one definition
- [ ] #4 A test covers the round trip through both surfaces and asserts they agree
- [ ] #5 The CLI, which consumes the REST surface, still round-trips block content correctly
<!-- AC:END -->
