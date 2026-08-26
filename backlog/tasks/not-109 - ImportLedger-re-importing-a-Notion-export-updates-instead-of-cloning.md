---
id: NOT-109
title: 'ImportLedger: re-importing a Notion export updates instead of cloning'
status: ready-for-agent
assignee: []
created_date: '2026-08-26 11:11'
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
- [ ] #1 Re-importing the same Notion export updates the previously imported pages, databases, fields and records instead of creating duplicates
- [ ] #2 The source-to-local identifier mapping is persisted, not held in memory for the duration of one run
- [ ] #3 Every identifier-minting site in the importer resolves through the ledger
- [ ] #4 The reported import counts reflect rows actually written and distinguish created from updated
- [ ] #5 The importer's orchestration is tested without a live database, by asserting the operations it produces from a fixture export tree
- [ ] #6 A test imports the same fixture twice and asserts the second run creates nothing new
<!-- AC:END -->
