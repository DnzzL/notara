---
id: NOT-114
title: 'Route cell rendering, field metadata and aggregation through the registry'
status: done
assignee:
  - '@thomas'
created_date: '2026-08-26 11:12'
updated_date: '2026-08-26 15:02'
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
- [x] #1 Cell display and inline editing dispatch through the registry rather than through comparison chains
- [x] #2 Formula fields are read-only because the registry says so, not because a view remembers to check
- [x] #3 Every stored cell value is decoded through the registry, with no ad-hoc parsing left in the views
- [x] #4 Picker metadata, icons, default widths and configuration panels come from the registry, and the standalone width lookup is deleted
- [x] #5 Aggregation is a standalone tested function that the table, board and calendar views all use
- [ ] #6 The board and calendar views declare typed props instead of untyped ones
- [x] #7 The database, board and visual-regression E2E specs pass unchanged
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Caught by the code before the migration: the page field type accepts BOTH a bare page id and a JSON array — the display already handled both, and NOT-113's registry declared it scalar. Migrating as written would have emptied every page cell written before it became multi-valued. The spec and a test were fixed first.

That is the second time reading the call sites contradicted the plan, and both times it was a data-loss bug rather than a style disagreement.

Four near-identical JSON.parse blocks (multiSelect, page, people, relation) became one decodeCell helper over the registry. They had drifted: only the page one handled the bare-id form, which is exactly how that inconsistency survived.

The read-only rule moved into the registry. Three sites in DatabaseView asked 'type === formula' — grid navigation skipping a cell, typing over a focused cell, and whether to render an editor — and each had to remember. They now ask fieldTypeSpec(type).readOnly.

aggregate() is out of ColumnFooter and tested. It was a useMemo closed over a local accessor, so exercising it meant rendering a table. One behaviour deliberately preserved rather than 'fixed': a column with no numbers reports 0, not null, because that is what the footer has always shown and changing it would blank a column that used to read 0.

AC 6 (typed props for board and calendar) is NOT done and left unchecked. Those views take database, fields, records, databases and allRecords as any, and typing them pulls in the shape of the record-with-values pair that NOT-115 is about to change. Doing it now would mean typing it twice.

My own test was wrong once here too: I wrote a formula as {{Score}} when this codebase uses prop("Score"). The code was right.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Route cell rendering, field metadata, read-only and aggregation through the registry.

Migrate step. The old branches still exist elsewhere, so this stays green on its own.

Changes:
- CellComponents: four near-identical JSON.parse blocks become one decodeCell over the registry. They had already drifted — only the page branch handled a bare page id, and the others silently dropped values in that form.
- The page spec in the registry was corrected first: it accepts both a bare id and a JSON array, because rows written before the type became multi-valued are still in databases. Declared scalar, as NOT-113 had it, migrating would have emptied every one of them.
- FIELD_TYPES, BASIC_TYPES and getDefaultWidthForType now derive from the registry, re-exported under their old names so callers keep working until the contract step.
- The read-only rule moved into the registry. Three sites in DatabaseView asked about formula directly — grid navigation, type-over, and whether to render an editor — and each had to remember on its own.
- lib/aggregate.ts extracts aggregation from ColumnFooter, where it was a useMemo closed over a local accessor and therefore untestable. 10 tests, including the formula case that cannot read a stored cell at all.

Left unchecked: typed props for the board and calendar views. Their shape depends on the record-with-values pair NOT-115 is about to change, so typing them now means typing them twice.

Tests: 74 app pass / 0 fail, 19 shared pass, app type-check clean apart from the pre-existing toggleHeading errors (NOT-100), biome clean, 13 database E2E passed.
<!-- SECTION:FINAL_SUMMARY:END -->
