---
id: NOT-113
title: 'Field-type registry: build the module alongside the existing branches'
status: done
assignee:
  - '@thomas'
created_date: '2026-08-26 11:12'
updated_date: '2026-08-26 14:47'
labels:
  - enhancement
dependencies: []
priority: high
ordinal: 108000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
EXPAND STEP of a wide refactor. This ticket adds the new form beside the old and changes no call site, so it lands green on its own.

The problem it prepares for: a database field type is declared as a union three times independently — in the shared schema, in the hand-written OpenAPI document, and again in the field components. There is no shared registry, and behaviour is scattered as chains of comparisons on the type. Adding one field type today touches roughly eighteen places across three packages, with no help from the compiler: every comparison site treats the type as a plain string rather than the union.

The eighteen: three unions; picker metadata and icons; default column width; per-type configuration UI; read rendering; write rendering; eight separate JSON decodes of stored values; filter operators and their coercion; the sort comparator; the filter value editor; board grouping; calendar mapping; footer aggregation and read-only rules; server-side encode, decode and migrate; import type inference in both the Notion importer and templates; and a second filter engine inside the view-reference block.

Target interface, one table entry per type:
  fieldTypeSpec(type) -> { label, icon, defaultWidth, decode, encode, compare, operators, isReadOnly, configPanel, Display, Editor }

Build the registry in the shared package so the server and both the import paths can consume it later. Cover every field type that exists today, including formula, relation and the multi-value types whose stored representation is JSON.

Two behaviours to get right here, because they are currently wrong and the migration tickets will inherit whatever this one defines:
- The comparator only special-cases numbers, so dates sort lexically. Each spec's compare must be correct for its own type.
- The read-only rule for formula fields currently lives in the callers rather than the field itself. isReadOnly belongs in the spec.

Nothing is wired up in this ticket. The registry is exercised entirely by its own unit tests.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A field-type registry exists in the shared package with one entry per field type in use today
- [x] #2 Each entry provides label, icon, default width, decode, encode, compare, operators and read-only status
- [x] #3 Dates, numbers and multi-value types each sort correctly through their own comparator
- [x] #4 Formula fields report themselves read-only through the registry
- [x] #5 Decode and encode round-trip every stored representation currently produced, including the JSON-encoded ones
- [x] #6 The registry is covered by unit tests and no existing call site is changed by this ticket
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
The registry lives in @notara/shared, not in the app, because NOT-116 needs it server-side for encode/decode and for the Notion importer's type inference. It therefore holds only the framework-free half — label, icon, basic, defaultWidth, readOnly, decode, encode, compare, operators. The React half (cell display, inline editor, config panel) is keyed by the same types on the app side in NOT-114, where React belongs.

Two behaviours were corrected rather than carried over. A registry that faithfully preserves a bug in one place instead of ten is not much of an improvement:
- compare only special-cased number, so dates sorted as text and checkboxes sorted 'false' before 'true' by accident of the alphabet. Dates now parse; checkboxes order unchecked-then-checked.
- readOnly did not exist anywhere. Formula fields are computed and the rule lived in whichever view remembered to check — the inline editor's props did not even mention formula.

Three decisions worth knowing before the migration tickets build on them:
- Blanks sort last in both directions, so an empty row never leads a sorted list.
- Unparseable values fall back to text comparison, so they group rather than scatter.
- fieldTypeSpec falls back to text for an unknown type: a workspace written by a newer build should render badly, not crash.

decodeList also reads the legacy comma-joined form, because Notion Status and Tag exports arrived that way and rows written then are still in the database.

Nothing is wired up. No existing call site changed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Field-type registry: the module, alongside the existing branches.

Expand step of a wide refactor — the new form lands beside the old and changes no call site, so it is green on its own.

The problem it prepares for: a field type is declared as a union three times independently, and behaviour is scattered as comparison chains across roughly eighteen sites in three packages, with no help from the compiler because every site treats the type as a plain string.

packages/shared/src/field-types.ts holds one entry per type with label, icon, basic/advanced placement, default width, read-only status, decode, encode, compare and filter operators. In shared rather than the app because the server and the Notion importer consume it in NOT-116; the React pieces join it app-side in NOT-114.

Two behaviours are corrected rather than preserved: comparison only special-cased numbers, so dates sorted as text and checkboxes by alphabet; and read-only did not exist, so the formula rule lived in the callers.

18 tests define what the migration tickets must preserve, including the corrections, blanks-sort-last, the legacy comma-joined multi-value form still present in databases, and the unknown-type fallback.

Tests: 18 shared pass / 0 fail, biome clean. The app type-check reports only the pre-existing toggleHeading errors tracked as NOT-100.
<!-- SECTION:FINAL_SUMMARY:END -->
