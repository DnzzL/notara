---
id: NOT-113
title: 'Field-type registry: build the module alongside the existing branches'
status: ready-for-agent
assignee: []
created_date: '2026-08-26 11:12'
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
- [ ] #1 A field-type registry exists in the shared package with one entry per field type in use today
- [ ] #2 Each entry provides label, icon, default width, decode, encode, compare, operators and read-only status
- [ ] #3 Dates, numbers and multi-value types each sort correctly through their own comparator
- [ ] #4 Formula fields report themselves read-only through the registry
- [ ] #5 Decode and encode round-trip every stored representation currently produced, including the JSON-encoded ones
- [ ] #6 The registry is covered by unit tests and no existing call site is changed by this ticket
<!-- AC:END -->
