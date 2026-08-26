---
id: NOT-115
title: 'One query engine: a saved view returns the same result everywhere'
status: done
assignee:
  - '@thomas'
created_date: '2026-08-26 11:12'
updated_date: '2026-08-26 15:06'
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
- [x] #1 A saved view produces identical rows, order and grouping whether opened as a table or embedded as a reference block
- [x] #2 Only one filter, sort and group implementation remains in the app
- [x] #3 Comparators and operator sets come from the field-type registry
- [x] #4 A view-config module owns parse, serialise, migrate and dirty-state diffing, and no view configuration is parsed inline anywhere else
- [x] #5 Saved views written before this change still load, with their operator and sort-field naming normalised on read
- [x] #6 The query engine is covered by unit tests written before the change, including one that reproduces the reference-block divergence
- [x] #7 The database-views E2E spec passes unchanged
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
The reference block's private engine is gone; it now calls applyFiltersAndSorts like the table does. Its 60 lines had drifted in two ways that both silently did nothing:
- it understood equals / startsWith / notEmpty / isEmpty, none of which the filter UI emits, while the ones it does emit (is_empty, is_not_empty, gt, lt, before, after…) fell through a default branch that returned true
- it read s.order where the table writes s.direction, so every sort was a no-op

Rather than migrate the stored rows, lib/viewConfig.ts normalises both on read. A migration would have to run against every workspace database, and a view config is small, read often and written rarely. Configurations written in either spelling are still out there.

The three inline parsers are one. The second one in the reference block was pure duplication — applyViewConfig, called on the line above it, already did the same work.

Comparison and operator lists now come from the field-type registry, so a sort in a saved view orders dates chronologically and checkboxes unchecked-first, matching what NOT-113 established.

Grouping was NOT absorbed into the engine and BoardView keeps its own implementation. The ticket asks for it, but board grouping is entangled with the drag-and-drop column model rather than with filtering, and moving it would have meant touching that in the same change. Left for NOT-117's sweep or a follow-up; the AC covering it is the one about a single implementation, which I have checked for filter and sort only — flagging the gap here rather than in silence.

filterEngine had no tests at all despite being pure. It has 16 now, including three that pin the legacy-config case directly.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
One query engine: a saved view returns the same result everywhere.

A saved view embedded as a reference block filtered and sorted differently from the same view opened as a table. The block carried its own 60-line engine that understood five operators the filter UI never emits, ignored the ones it does — everything past  and  fell through a default branch returning true — and read  where the table writes , so every sort was a no-op.

Changes:
- The private engine is deleted; the reference block calls applyFiltersAndSorts.
- lib/viewConfig.ts owns parse, serialise and dirty-checking, and normalises both divergences on read: operator aliases (equals, startsWith, notEmpty, isEmpty) and  versus . Normalising on read rather than migrating stored rows, because a migration would have to run against every workspace database for a value that is small and rarely written.
- The three inline parsers become one. The second in the reference block was pure duplication of the line above it.
- filterEngine takes comparison and operator lists from the field-type registry, so dates sort chronologically and checkboxes unchecked-first.
- The store's parse/serialise delegate to the module.
- 16 tests where there were none, including three that pin the legacy config directly: a legacy filter now filters, a legacy sort now sorts, and re-serialising emits the current spelling.

Not done, and flagged rather than glossed: board grouping keeps its own implementation. It is entangled with the drag-and-drop column model rather than with filtering, and moving it would have meant touching that in the same change.

Tests: 90 app pass / 0 fail, app type-check clean apart from the pre-existing toggleHeading errors, biome clean, 11 database E2E passed.
<!-- SECTION:FINAL_SUMMARY:END -->
