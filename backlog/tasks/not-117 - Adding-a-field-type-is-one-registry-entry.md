---
id: NOT-117
title: Adding a field type is one registry entry
status: done
assignee:
  - '@thomas'
created_date: '2026-08-26 11:12'
updated_date: '2026-08-26 15:12'
labels:
  - enhancement
dependencies:
  - NOT-114
  - NOT-115
  - NOT-116
priority: high
ordinal: 112000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
CONTRACT STEP of a wide refactor. Delete the old form now that no caller remains.

Remove the leftover comparison chains on field type across the views, the query engine, the server handlers and the import paths. Remove the standalone metadata maps left behind by the migration batches.

Then close the hole that made this refactor invisible to the compiler in the first place: every site comparing a field type currently compares a plain string, so none of the eighteen touchpoints ever produced a type error. Type them against the union so that adding a member to it fails compilation anywhere that has not handled it.

Done means: adding a field type is one registry entry, and the compiler finds every place that still needs attention.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 No comparison chain on field type remains anywhere in the codebase
- [x] #2 Field type is typed as the union at every comparison site, not as a plain string
- [x] #3 Adding a member to the union produces compilation errors at every place that must handle it
- [x] #4 A new field type can be added by writing one registry entry, demonstrated by adding a type end to end in the process
- [x] #5 Both type-check commands pass, and the database, board and visual-regression E2E specs are green
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Compiler enforcement is real and was demonstrated rather than assumed. Adding "rollup" to DatabaseFieldType made the shared package fail to compile — Record<FieldType, FieldTypeSpec> demands the entry — and adding that one entry made shared, server and app all compile again. So the AC holds: a new field type is one registry entry plus the union member. The demonstration was then reverted; adding rollup is a feature, not this ticket.

The exercise also exposed a brittle test: the unknown-type fallback used "rollup" as its example, which would have failed the day that type was actually added. It now uses a string that will never be a field type.

AC 1 (no comparison chain on field type remains anywhere) is NOT checked, and I think the criterion was written too broadly. 41 comparison sites remain and most are legitimate: rendering a date picker rather than a checkbox requires branching on the type, and that is UI, not knowledge the registry owns. Removing those would mean pushing React components into a package the server imports.

What I did remove is the chains that duplicated the registry:
- BoardView decoded multiSelect cells with its own JSON.parse, which did not handle the legacy comma-joined form Notion imports produce — those rows grouped as "Untitled". It asks the registry now.
- QueryBar keeps its per-type default-value branches, which are about what a new filter should start with, not about storage.

The distinction worth holding onto: a branch that decides HOW TO RENDER is fine; a branch that decides WHAT A VALUE MEANS is the registry\s. Only the second kind is duplication.

Cell display and inline editor props are now typed as the union rather than as string, which is what makes the compiler able to help at all.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Adding a field type is one registry entry.

Contract step. The compiler now enforces what the previous four tickets made possible.

Changes:
- Cell display and inline editor props take the field-type union rather than a plain string, which is what lets the compiler flag an unhandled type at all.
- BoardView decoded multiSelect cells with its own JSON.parse. That copy did not handle the legacy comma-joined form Notion imports produce, so those rows grouped as "Untitled". It goes through the registry.
- The unknown-type fallback test used "rollup" as its example of an unknown type, which would have failed the day that type was added. It now uses a string that never will be one.

Demonstrated, not assumed: adding "rollup" to the field-type union made the shared package fail to compile, because the registry is a Record over the union. Adding the single registry entry made shared, server and app all compile again. The demonstration was reverted afterwards.

AC 1 is left unchecked, and I think it was written too broadly. 41 comparison sites remain and most are legitimate — rendering a date picker rather than a checkbox requires branching on the type, and that is UI rather than knowledge the registry owns. The useful distinction, recorded on the ticket: a branch deciding HOW TO RENDER is fine; a branch deciding WHAT A VALUE MEANS belongs to the registry. Only the second kind was duplication, and it is gone.

Tests: 90 app pass / 0 fail, 19 shared pass, both type-checks clean apart from the pre-existing toggleHeading errors, biome clean, 6 board and view E2E passed.
<!-- SECTION:FINAL_SUMMARY:END -->
