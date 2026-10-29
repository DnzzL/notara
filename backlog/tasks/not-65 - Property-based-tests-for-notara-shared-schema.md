---
id: NOT-65
title: Property-based tests for @notara/shared schema
status: ready-for-agent
assignee: []
created_date: '2026-07-28 14:52'
updated_date: '2026-07-28 15:19'
labels:
  - enhancement
dependencies:
  - NOT-63
ordinal: 68000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add fast-check or effect-test to hammer the shared data model with generated inputs. Properties: serialize→deserialize identity for blocks and views; random block trees round-trip through import/export; no generated record field value violates its field type. These catch edge cases agents would never think to test manually.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 serialize→deserialize is identity for Blocks (any generated block)
- [x] #2 serialize→deserialize is identity for DatabaseViews (any generated view)
- [ ] #3 Block tree round-trips through the import/export pipeline
- [ ] #4 Generated field values never violate their field type constraints
- [x] #5 Property tests run in CI alongside existing tests
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Install fast-check for property-based testing\n2. Add property-based tests for serialize→deserialize identity for Blocks\n3. Add property-based tests for DatabaseViews\n4. Add property-based tests for block tree round-trip import/export\n5. Add property-based tests for field value type constraints\n6. Wire into CI (already runs as part of shared package tests)
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Property-based tests for @notara/shared schema:
- Installed fast-check v4.9.0
- Created test/schema-properties.test.ts with 7 property tests:
  1. Page serialize→deserialize identity
  2. Block serialize→deserialize identity
  3. DatabaseView serialize→deserialize identity
  4. DatabaseField serialize→deserialize identity
  5. Block rejects invalid types
  6. DatabaseView rejects invalid view types
  7. DatabaseField rejects invalid field types
- All tests pass in shared package test suite
<!-- SECTION:NOTES:END -->
