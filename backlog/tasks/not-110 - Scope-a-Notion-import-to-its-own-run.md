---
id: NOT-110
title: Scope a Notion import to its own run
status: done
assignee:
  - '@thomas'
created_date: '2026-08-26 11:11'
updated_date: '2026-08-26 14:38'
labels:
  - bug
dependencies:
  - NOT-109
priority: high
ordinal: 105000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Two passes of the Notion importer operate on the whole workspace rather than on the import being performed.

Placeholder resolution scans blocks workspace-wide for database-reference markers, so a second import can rewrite placeholders belonging to the first. The empty-leaf prune deletes any empty page in the workspace, so a second import can delete pages the first one created — or pages the user wrote by hand between the two.

Nothing runs in a transaction, so a failure part-way leaves both the workspace and the ledger in a state no one planned.

Build on the run scope introduced by the ledger: both passes must operate only on identifiers produced by the current run.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Placeholder resolution only touches content created or updated by the current import run
- [x] #2 The empty-page prune only considers pages created by the current import run
- [ ] #3 A failure part-way through an import leaves no half-written import behind
- [x] #4 A test runs two imports over different fixture trees and asserts the second leaves the first's pages, databases and hand-written pages untouched
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Both workspace-wide passes are now scoped by a subquery against import_ledger on last_run_id, rather than by an IN list of ids — a large export would otherwise blow past SQLite's bound-parameter limit.

A re-imported page counts as this run's, because resolving an existing key claims it for the current run. So a chain of stubs left by an earlier import is still prunable when this run touches it, while a page the user wrote by hand is not.

One consequence that needed handling: a pruned page must have its ledger row deleted too, or the next run resolves that key to a page that no longer exists and then UPDATEs nothing.

AC 3 (a failure leaves no half-written import) is implemented but NOT proven, so it stays unchecked. The whole run is now one sql.withTransaction, which also covers the ledger rows — without that, a failed run would leave the ledger claiming ids for content that was never committed, and the NEXT import would update rows that do not exist. Verified only that the happy path still works: forcing a deterministic mid-import failure needs a fixture built for it, which is a piece of work of its own.

Not covered by the rollback, and written into the docstring: attachment files copied to disk. A failed run leaves orphans there. They are unreferenced and harmless; making file copies transactional is a different problem.

The E2E was verified red against the unscoped importer: 'My Empty Draft' was deleted by the second import.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Scope a Notion import to its own run.

Two passes of the importer operated on the whole workspace. Placeholder resolution rewrote any block carrying a database or page reference, and the empty-page prune deleted any empty page it found — so a second import could rewrite the first one's blocks, delete its stubs, or delete a page the user had created and not yet typed into.

Changes:
- Both placeholder passes and the prune are scoped by a subquery against import_ledger on last_run_id. A subquery rather than an IN list, so a large export cannot exceed SQLite's bound-parameter limit.
- A pruned page has its ledger row deleted with it, or the next run would resolve that key to a page that is gone.
- The whole run is one transaction. This matters more since the ledger exists: a failure used to leave partial content, and would now also leave ledger rows claiming ids for content never committed — so the next import would update rows that do not exist. Either the import lands or the workspace is untouched. Attachment files copied to disk are outside the rollback and can be orphaned; noted in the docstring.

The E2E imports two different exports with a hand-written empty page created between them, and asserts all three survive. Verified red against the unscoped importer, where the user's page was deleted.

Left unchecked on the ticket: rollback on a mid-import failure is implemented but not proven — forcing a deterministic failure needs a fixture built for it.

Tests: 212 unit pass / 0 fail, both type-checks and biome clean, 14 E2E passed.
<!-- SECTION:FINAL_SUMMARY:END -->
