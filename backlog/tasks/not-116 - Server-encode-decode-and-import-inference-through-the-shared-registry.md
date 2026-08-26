---
id: NOT-116
title: 'Server encode, decode and import inference through the shared registry'
status: ready-for-agent
assignee: []
created_date: '2026-08-26 11:12'
updated_date: '2026-08-26 11:14'
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
- [ ] #1 Server-side field encoding, decoding and migration go through the shared registry
- [ ] #2 Notion import and template field-type inference go through the shared registry
- [ ] #3 The field-type union is declared once, in the shared schema
- [ ] #4 The OpenAPI document derives its field-type enumeration rather than restating it
- [ ] #5 A test asserts a value encoded by the server decodes to the same value through the registry, for every field type
<!-- AC:END -->
