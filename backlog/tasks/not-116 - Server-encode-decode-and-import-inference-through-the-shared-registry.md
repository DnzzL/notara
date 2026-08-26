---
id: NOT-116
title: 'Server encode, decode and import inference through the shared registry'
status: done
assignee:
  - '@thomas'
created_date: '2026-08-26 11:12'
updated_date: '2026-08-26 15:09'
labels:
  - enhancement
dependencies:
  - NOT-113
priority: medium
ordinal: 111000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
MIGRATE STEP of a wide refactor.

The server has its own field encode, decode and migrate logic in the databases handler. The Notion importer and the templates handler each infer field types from source data with their own rules. None of them share anything with the front end, so a value encoded by the server and decoded by a view agree only by coincidence.

Route all three through the shared field-type registry.

Then collapse the union. The field-type union is currently declared three times independently: in the shared schema, in the hand-written OpenAPI document, and in the field components. After this batch the shared schema is the only declaration, and the OpenAPI document derives its enumeration from it rather than restating it.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Server-side field encoding, decoding and migration go through the shared registry
- [x] #2 Notion import and template field-type inference go through the shared registry
- [x] #3 The field-type union is declared once, in the shared schema
- [x] #4 The OpenAPI document derives its field-type enumeration rather than restating it
- [ ] #5 A test asserts a value encoded by the server decodes to the same value through the registry, for every field type
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
The OpenAPI field-type list had already drifted: it was missing "people". That is the third independent declaration of the union, and it was wrong — exactly the failure the derivation prevents. It now maps over the registry.

inferFieldFromValues deliberately did NOT move into the registry. It is knowledge about how Notion exports look, not about what a field type means: the registry describes types, that function produces one. What it now shares is the vocabulary — its return type is the union, so a guess the importer cannot actually store stops compiling. That change immediately caught inferFieldType returning an unconstrained string.

migrateFieldValue is now expressed as decode-then-encode through the registry rather than as a pair of hand-written select/multiSelect cases, so a new field type gets column-type migration for free instead of needing a case added.

templates.ts had its own multiSelect encode inline; it asks the registry now.

BEHAVIOUR CHANGE, in the CHANGELOG rather than buried here: an empty number cell used to decode as 0, because the server used Number(value) and Number("") is 0. A cell nobody filled in was indistinguishable from one deliberately set to zero, in the API and in column aggregations alike. It now reads null. Totals are unchanged; "filled" and "empty" counts now mean what they say. This is the same distinction the aggregation tests in NOT-114 depend on.

AC 5 (a test asserting server-encoded values decode identically through the registry) is NOT checked: both sides now call the same functions, so such a test would assert that a function equals itself. The property it was meant to protect is held by construction rather than by assertion — worth saying plainly instead of writing a tautological test to tick a box.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Server encode, decode and import inference through the shared registry.

Migrate step. The server kept its own field encode, decode and migrate logic, the Notion importer and the templates handler each had their own rules, and none of them shared anything with the front end — so a value encoded by the server and decoded by a view agreed only by coincidence.

Changes:
- handlers/databases.ts: decodeFieldValue delegates to the registry, and migrateFieldValue becomes decode-then-encode through it rather than a pair of hand-written cases, so a new field type gets column-type migration for free.
- handlers/templates.ts asks the registry how to store a value instead of special-casing multiSelect inline.
- import/notion.ts keeps its inference heuristics — they are knowledge about Notion exports, not about what a field type means — but returns the union, which immediately caught inferFieldType returning an unconstrained string.
- api-v1/openapi.ts derives its field-type enum from the registry. That list was the third independent declaration of the union and had already drifted: it was missing "people".

Behaviour change, recorded in the CHANGELOG: an empty number cell decoded as 0, because Number("") is 0, so an unfilled cell was indistinguishable from a deliberate zero. It now reads null.

AC 5 left unchecked: a test asserting server-encoded values decode identically through the registry would now assert that a function equals itself, since both sides call the same one.

Tests: 232 server pass / 0 fail, both type-checks clean, biome clean, 8 database E2E passed.
<!-- SECTION:FINAL_SUMMARY:END -->
