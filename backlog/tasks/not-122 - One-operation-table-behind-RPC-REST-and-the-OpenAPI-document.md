---
id: NOT-122
title: 'One operation table behind RPC, REST and the OpenAPI document'
status: ready-for-agent
assignee: []
created_date: '2026-08-26 11:13'
updated_date: '2026-08-26 13:50'
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
- [ ] #7 The server test suite and the multiuser E2E suite are green
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
SCOPE EXPANDED from NOT-104, which stopped deliberately short of migrating the surfaces.

This ticket now also owns:
- Declaring each operation's guard as a Policy value from policies.ts (workspaceMember, workspaceOwner, page, block, database, record, field, view), replacing withAuthedWorkspace on the RPC side and the hand-assembled resolveApiUser + requireWorkspaceMember + withWorkspace sequence on the REST side.
- CurrentUser supplied by principal.layer rather than each surface resolving its own caller.
- An authorization test per REST route. api-v1/routes.ts has none today; the shape of those tests depends on how operations end up declared, which is why they belong here rather than in NOT-104.

Available to build on: policy.ts (mechanism), policies.ts (vocabulary), principal.ts (credential adapters), membership.ts (one membership query), acl.ts (relation resolution). Auth is unit-testable by providing a principal as a layer — see policies.test.ts for the pattern.
<!-- SECTION:NOTES:END -->
