---
id: NOT-104
title: Composable Policy module with classic Zanzibar rewrite rules
status: ready-for-agent
assignee: []
created_date: '2026-08-26 11:10'
labels:
  - enhancement
dependencies: []
priority: high
ordinal: 99000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Authorization has one real chokepoint and five ad-hoc ones. The RPC surface routes all of its methods through a single authed-workspace wrapper; the REST surface reassembles the same ordering by hand on every route; the two SSE streams each inline their own session lookup; the admin routes go through a closure of their own. That is how the invite-token defect (NOT-102) happened: a method sat next to two others that check ownership and simply did not.

Duplication to kill: the workspace-membership SQL is character-identical in five places across workspace-context.ts, api-v1/auth.ts and handlers/permissions.ts. The error-to-HTTP mapping exists twice (http-error.ts and api-v1/response.ts) with a second ApiError type declared in api-v1/auth.ts.

Dead or dangerous code to delete: resolveWorkspaceContext and its WorkspaceContext tag have zero callers. withWorkspaceDb performs NO authentication and trusts the X-Workspace-Id header outright.

TARGET SHAPE — Policy module (~40 lines), adapted from https://lucas-barake.github.io/building-a-composable-policy-system/

Take from the article: a CurrentUser Context.Tag; the type Policy = Effect<void, AuthError, CurrentUser | R>; the combinators policy / withPolicy / all / any; domain policy services wrapping the existing ACL. Place the guard LAST in the pipe so it evaluates FIRST — fail fast before opening the workspace layer.

Do NOT take from the article: makePermissions / InferPermissions / the domain:action literal union (this repo already has relations and rank comparison; a second permission vocabulary would recreate the duplication this ticket exists to remove). Do NOT take HttpApiMiddleware.Tag — this server runs on @effect/rpc plus a hand-rolled HttpRouter, not @effect/platform HttpApi, so CurrentUser comes from a Layer built off the request.

Credential adapters at the seam: better-auth cookie, API key, and an injected test principal. Three adapters, so the seam is real rather than hypothetical.

ZANZIBAR — go to the classic model, not the current approximation

What exists already and is good: relation tuples keyed (resource_type, resource_id, subject) with one relation per subject, a canonical subject format covering usersets and public, and per-resource revisions usable as zookies.

What is NOT classic and must change:

1. Inheritance is hardcoded. resolveEffectiveRelation walks the page tree and treats the first ancestor carrying tuples as the effective ACL owner, with a workspace-owner short-circuit ahead of it. Replace with a declarative namespace config per resource type, where each relation is a union of this / computedUserset / tupleToUserset. Shape:

  page:      owner  = this
             editor = this | owner | parent->editor
             viewer = this | editor | parent->viewer
  workspace: member = this
             owner  = this

  The resolver becomes a generic evaluator over that config. No resolution order encoded in control flow.

2. The rank ladder goes away. Comparing relations by numeric rank is an approximation of relation inclusion; the rewrite rules express it directly, so satisfies() and its RANK map are deleted rather than kept alongside.

3. Workspace membership becomes tuples. Membership and workspace ownership are ordinary tuples, so the workspace-member userset subject resolves through the same path as everything else and the five SQL copies disappear structurally instead of being factored. The workspace_members table stays as the profile record (join date, invitations, seats).

CONSTRAINT TO RESOLVE EXPLICITLY, do not paper over it: membership currently lives in the platform database while ACL tuples live in the per-workspace database, and the resolver reads both. Listing the workspaces a user belongs to must remain a single platform-level query — it cannot fan out across every workspace database. Decide and document whether membership tuples live in a platform-level tuple table, or whether workspace_members remains the storage and is projected as tuples by the resolver. State the choice in the implementation notes.

Migrate all four surfaces: RPC, REST, both SSE streams, and admin.

THE DECISIVE GAIN is testability. Today any auth assertion needs a booted server and a real cookie — the route-auth test spawns the server on a port and asserts only 401s, and api-v1/routes.ts has no tests at all because nothing imports its route registration. An injectable principal makes authorization unit-testable.

Scope note: this is deliberately one large ticket rather than a sequence, by explicit decision. Land it behind a green E2E multiuser suite.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A Policy module exposes policy / withPolicy / all / any, with Policy typed as an Effect requiring CurrentUser and failing with the shared auth error
- [ ] #2 CurrentUser is provided by three interchangeable credential adapters: session cookie, API key, and an injected test principal
- [ ] #3 Relation resolution is driven by a declarative namespace config using this / computedUserset / tupleToUserset; no inheritance order remains encoded in control flow
- [ ] #4 The numeric rank ladder and its comparison helper are deleted, with relation inclusion expressed by the rewrite rules instead
- [ ] #5 Workspace membership and workspace ownership are relation tuples; listing a user's workspaces remains a single platform-level query, and the storage decision is recorded in the implementation notes
- [ ] #6 No workspace-membership SQL is duplicated anywhere in the server
- [ ] #7 resolveWorkspaceContext, its context tag, and the header-trusting withWorkspaceDb are deleted
- [ ] #8 RPC, REST, both SSE streams and the admin routes all authorize through the same module
- [ ] #9 A single error-to-HTTP mapping remains, and the duplicate ApiError type is gone
- [ ] #10 Authorization is unit-tested by providing a mock principal as a layer, with no server booted and no cookie involved
- [ ] #11 Every REST route has an authorization test, closing the gap where that surface had none
- [ ] #12 The existing multiuser E2E suite passes unchanged
<!-- AC:END -->
