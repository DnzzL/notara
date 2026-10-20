---
id: NOT-109
title: 'ImportLedger: re-importing a Notion export updates instead of cloning'
status: done
assignee:
  - '@thomas'
created_date: '2026-08-26 11:11'
updated_date: '2026-08-26 14:36'
labels:
  - bug
dependencies: []
priority: high
ordinal: 104000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Known debt. Re-running a Notion import clones every database rather than updating what is already there — one workspace ended up with thirteen copies.

Structurally, no module owns the mapping from source identifier to local identifier. It is three in-memory maps created inside a single ~490-line effect, and every insert mints a fresh identifier unconditionally — pages, databases, fields, records and record pages alike. No migration carries a source-guid column anywhere. Re-running is therefore a clone by definition, not by accident.

The return value is not reconcilable either: the imported-page count is computed from a count of FILES on disk, not rows written, and the caller throws the page map away.

Target interface: a ledger module owning (source system, source guid) -> local id, persisted in a table, exposing resolve-or-create — resolve(kind, sourceGuid) returning the id and whether it was created. Every identifier-minting site in the importer goes through it.

The effect worth chasing: with identity behind one seam, the importer becomes a files-to-operations function that can be tested without SQL. Today only the pure helpers are tested — markdown-to-blocks, title parsing, parent resolution — while the orchestration is reachable only with a real SQLite file and a real export tree.

Scoping of placeholder resolution and of the empty-page prune is a separate ticket that builds on the run scope this one introduces.

This is the first thing a launch-day user does, and they will do it twice if the first attempt looks wrong.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Re-importing the same Notion export updates the previously imported pages, databases, fields and records instead of creating duplicates
- [x] #2 The source-to-local identifier mapping is persisted, not held in memory for the duration of one run
- [x] #3 Every identifier-minting site in the importer resolves through the ledger
- [ ] #4 The reported import counts reflect rows actually written and distinguish created from updated
- [ ] #5 The importer's orchestration is tested without a live database, by asserting the operations it produces from a fixture export tree
- [x] #6 A test imports the same fixture twice and asserts the second run creates nothing new
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Identity keys, and why each is what it is:
- page — the Notion GUID from the file name, falling back to path:<relPath> when the export carries none
- database — the CSV's path within the export
- field — <databaseId>::<header>
- record — <databaseId>::<row title>
- three synthesised page kinds — wrapper:<csvPath> for the page created around an isolated CSV, record:<file> and recordFolder:<dir> for record backing pages. These three were minting fresh ULIDs too, so they cloned as surely as the pages did.

Fields and records are keyed by name because a Notion CSV export carries no per-column or per-row identifier. Renaming a column in Notion therefore reads as a new column on re-import. That is the export format's limitation rather than a preference, and it is better than duplicating the whole database each run. Written into the migration and the module so the next reader does not think it was an oversight.

Re-import semantics: the export is authoritative. An existing page has its blocks deleted and rewritten rather than diffed, and an existing record has its cell values replaced. Blocks and cell values carry no stable identity of their own, so there is nothing to diff against — and 'import this export again' should mean the export wins.

Deliberately still minting fresh ids: block rows, cell-value rows (both replaced wholesale above) and copied attachment files. A re-import re-copies assets; that is duplication on disk, not the database cloning this ticket is about.

AC 4 (counts distinguishing created from updated) and AC 5 (orchestration tested without a live database) are NOT done. The ledger makes both reachable — resolve already returns created — but the return value still reports sourceFiles.length, and extracting the 490-line orchestration into a files-to-operations function is a separate piece of work. Left unchecked rather than claimed.

The E2E test was verified against the unfixed importer first: two pages titled Roadmap instead of one.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
ImportLedger: re-importing a Notion export updates instead of cloning.

Known debt, and the first thing a launch-day user does — twice, if the first attempt looks wrong. The importer held three in-memory maps for the duration of one run and minted a fresh ULID for every row it wrote, with no migration carrying a source identifier anywhere. Re-running was a clone by definition, not by accident; one workspace ended up with thirteen copies of every database.

Changes:
- migrations/019_import_ledger.sql: a persisted map from what a thing is called in the export to what it is called here, keyed by (source, kind, source_key), with last_run_id so a run can act on its own artifacts.
- import/ledger.ts: one question — resolve-or-create — returning the id and whether this run minted it, which is what lets every call site choose INSERT or UPDATE without knowing how identity is stored. Plus scopedIds, which NOT-110 needs.
- import/notion.ts: all seven durable-identity sites now resolve through the ledger — pages in both passes, the wrapper page around an isolated CSV, both kinds of record backing page, databases, fields and records. Existing rows are updated and un-deleted; page blocks and record cell values are replaced, since the export is authoritative and neither carries an identity to diff against.
- 10 unit tests for the ledger, including the property the maps it replaces could not have: the same id across two separate runs.
- An E2E that imports the same export twice and asserts the page and database counts do not move. Verified red against the unfixed importer (2 pages instead of 1).

Not done, and left unchecked on the ticket: reporting created-versus-updated counts, and testing the orchestration without a database. The ledger makes both reachable; neither is this change.

Tests: 234 unit pass / 0 fail, both type-checks and biome clean, 13 E2E passed.
<!-- SECTION:FINAL_SUMMARY:END -->
