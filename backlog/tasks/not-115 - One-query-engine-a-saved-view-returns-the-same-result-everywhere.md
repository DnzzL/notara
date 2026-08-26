---
id: NOT-115
title: 'One query engine: a saved view returns the same result everywhere'
status: ready-for-agent
assignee: []
created_date: '2026-08-26 11:12'
updated_date: '2026-08-26 11:14'
labels:
  - bug
dependencies:
  - NOT-113
priority: high
ordinal: 110000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
MIGRATE STEP of a wide refactor, and a user-visible defect in its own right.

A saved view embedded as a reference block filters and sorts differently from the same saved view opened as a table. There are three query implementations:

The main filter engine supports thirteen operators and reads a sort's direction field. The view-reference block re-implements filtering with five operators — none of which the main engine ever emits — and reads a sort's order field, which the main engine does not write. So a saved view's filters silently do nothing in a reference block, and its sorts silently do nothing. The board view is a third private implementation of grouping with its own multi-value decoding.

Filtering, sorting and grouping are entirely client-side: the server exposes no filter, sort or group parameters and returns every row. That stays as it is — this ticket unifies the client engine, it does not move work to the server.

Target: delete the second engine, make the main filter engine the sole seam, absorb grouping and aggregation into it, and take comparators and operator sets from the field-type registry rather than from a single hardcoded number case.

Also add a view-config module. Serialising and parsing a view configuration is currently a wrapper around JSON stringify, and it is not even the seam — the view-reference block re-implements the parse inline in two places. One module owns parse, serialise, migrate and the dirty-state diff, and normalises the operator and sort-field mismatches on read so existing saved views keep working.

The main filter engine has no tests at all today despite being pure and trivially testable. Write them first; they define done for this ticket.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A saved view produces identical rows, order and grouping whether opened as a table or embedded as a reference block
- [ ] #2 Only one filter, sort and group implementation remains in the app
- [ ] #3 Comparators and operator sets come from the field-type registry
- [ ] #4 A view-config module owns parse, serialise, migrate and dirty-state diffing, and no view configuration is parsed inline anywhere else
- [ ] #5 Saved views written before this change still load, with their operator and sort-field naming normalised on read
- [ ] #6 The query engine is covered by unit tests written before the change, including one that reproduces the reference-block divergence
- [ ] #7 The database-views E2E spec passes unchanged
<!-- AC:END -->
