---
id: NOT-114
title: 'Route cell rendering, field metadata and aggregation through the registry'
status: ready-for-agent
assignee: []
created_date: '2026-08-26 11:12'
updated_date: '2026-08-26 11:14'
labels:
  - enhancement
dependencies:
  - NOT-113
priority: high
ordinal: 109000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
MIGRATE STEP of a wide refactor. The old branches still exist, so this batch stays green on its own.

Move the front-end database view onto the field-type registry:

Rendering. The read-display chain and the inline-editor chain are long comparison ladders, plus separate popovers and autocompletes for select, relation and person values. Both become dispatchers over the registry. The inline editor's props omit formula entirely, which is why the read-only rule currently lives in the caller — take it from the registry instead.

Value decoding. Eight separate JSON parses of stored cell values across the cell components and the board view all go through the registry's decode.

Metadata. Picker entries, the basic-versus-advanced split, icons, default column widths and the per-type configuration panels all come from the registry rather than from their own maps. The exported default-width lookup, a map read dressed up as an interface, goes away.

Aggregation. The column footer computes aggregates inside a private component closed over a local value accessor, so it is neither testable nor reusable by the board and calendar views. Extract an aggregate function taking rows, a field and an aggregation, and have the footer call it.

View props. The board and calendar views take database, fields, records, databases and all-records as untyped values — a wide interface stating no invariants at all. Type them against the domain schema as part of this batch.

The E2E database and board suites are the non-regression net; keep them green.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Cell display and inline editing dispatch through the registry rather than through comparison chains
- [ ] #2 Formula fields are read-only because the registry says so, not because a view remembers to check
- [ ] #3 Every stored cell value is decoded through the registry, with no ad-hoc parsing left in the views
- [ ] #4 Picker metadata, icons, default widths and configuration panels come from the registry, and the standalone width lookup is deleted
- [ ] #5 Aggregation is a standalone tested function that the table, board and calendar views all use
- [ ] #6 The board and calendar views declare typed props instead of untyped ones
- [ ] #7 The database, board and visual-regression E2E specs pass unchanged
<!-- AC:END -->
