---
id: NOT-122
title: 'One operation table behind RPC, REST and the OpenAPI document'
status: ready-for-agent
assignee:
  - '@thomas'
created_date: '2026-08-26 11:13'
updated_date: '2026-08-27 07:29'
labels:
  - enhancement
dependencies:
  - NOT-104
  - NOT-106
  - NOT-107
priority: medium
ordinal: 117000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Behaviour is already shared — both surfaces import the same handler modules. What is written three times is the choreography around them, and what is written four times is the shape of the domain: as effect schemas in the shared package, as hand-written JSON schema in the OpenAPI document, and as row mappers on the server.

The RPC layer is 910 lines of roughly sixty-eight mechanically identical ten-line adapters. Its interface is as large as its behaviour.

Target: each operation declares once its resource, its required relation or policy, its input, its output and how to run it. RPC, REST and the OpenAPI document become adapters derived from that table.

This also fixes a correctness problem in the REST surface: the permission check and the mutation currently run in two separate workspace-layer acquisitions, so the check and the write share no transaction. One declaration means one acquisition.

Delete the pass-through modules the table makes redundant: the REST workspace wrapper, eight lines of interface for two of behaviour; the response helpers that only wrap a status code, keeping the one that actually handles error mapping; and the onboarding handler, forty lines around a single insert with two callers.

Depends on the Policy module, whose required-relation vocabulary this table declares against; on the OpenAPI parity test, which becomes the guard that the derivation is correct; and on the block-content codec move, so the table declares one content shape rather than two.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Each operation is declared once with its resource, required relation, input, output and implementation
- [ ] #2 RPC, REST and the OpenAPI document are all derived from that declaration
- [ ] #3 The OpenAPI document is no longer maintained by hand, and the parity test still passes
- [ ] #4 A permission check and the mutation it guards share one workspace-layer acquisition
- [ ] #5 The redundant REST wrapper, the status-code response helpers and the onboarding handler are deleted
- [ ] #6 The CLI, which consumes the REST surface, works unchanged against the derived routes
- [x] #7 The server test suite and the multiuser E2E suite are green
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
PARTIAL. Delivered the inherited AC and the prerequisite for the rest; the operation table itself is NOT built. Reasoning, since a partial delivery is only useful if the boundary is stated.

WHAT VERIFICATION CHANGED. All three deletions in AC5 are wrong or inadvisable:
- withWorkspace in routes.ts is 8 lines of interface for 2 of behaviour, as the ticket says — but it is used 51 times. Deleting it inlines wdb.getLayer at every one. It stops being redundant only once the table exists, not before.
- The response helpers ok/created/noContent are not pure wrappers: they carry the JSON content type AND the CORS header block. Deleting them repeats that at 28 sites.
- handlers/onboarding.ts is 40 lines that seed a page and its blocks, acquire their own layer, and document that failures are swallowed by the caller. Two callers. Not a pass-through.

WHAT IS REAL. The double acquisition (AC4) is real: every route calls withWorkspace once for the permission check and again for the operation it guards. The harm is smaller than the ticket implies — getLayer is cached, so both get the same SqlClient, and neither opens a transaction — so it is a shape problem and a small TOCTOU window rather than a live defect.

WHAT SHIPPED. e2e/rest-authorization.spec.ts. api-v1/routes.ts had no tests at all, flagged in NOT-104 and moved here. 28 workspace routes are now driven from a table and asserted to refuse an authenticated non-member — the exact shape of NOT-102 on the REST side. A second test cross-checks that table against the OpenAPI document, so a route added without a guard cannot also be a route nobody remembered to list. Verified by deleting the guard from PATCH /pages/:pageId: the audit failed and named it.

Also confirmed while writing it: no REST route is currently unguarded. Each of the 28 has either a resource permission check or an explicit membership check. GET /api/v1/workspaces has neither and needs neither — it lists the caller\s own workspaces.

WHAT REMAINS, and why it was right to stop. The table (AC1-3) means rewriting 28 route bodies and deriving the OpenAPI document from them. That is safe to attempt NOW and was not before: the audit plus the existing parity test give it a net. Attempting it in the same pass as building its net would have meant rewriting 28 routes against tests written minutes earlier, with no independent check that either was right.

I also wrote and then removed an inWorkspace helper — the single-acquisition counterpart to withAuthedWorkspace — because leaving it unused is worse than not adding it. It belongs in the same change as the route rewrite.

CORRECTED after code review. The audit was too lenient: it treated any status >= 400 as a refusal, so a 500 from a crash, or a 400 from body validation ordered before the guard, would have stood in for authorization that never ran — and the test would have kept passing after a guard was deleted. It now requires 401, 403 or 404 specifically. All 28 routes still pass, so the leniency was not hiding anything, but the test is worth something now.

Also raised, and worth recording rather than fixing: the coverage cross-check reads openapi.json rather than the router, so a route registered but undocumented escapes both tests. The parity test in NOT-106 closes that transitively by asserting the document and the router agree — but it is a chain of two tests rather than one direct check. Worth collapsing when the operation table lands and the document becomes derived.
<!-- SECTION:NOTES:END -->
