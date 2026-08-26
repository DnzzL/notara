---
id: NOT-104
title: Composable Policy module with classic Zanzibar rewrite rules
status: ready-for-agent
assignee:
  - '@thomas'
created_date: '2026-08-26 11:10'
updated_date: '2026-08-26 13:38'
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

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
DECISION (inheritance semantics) — taken before implementation, after the ticket's original framing was found to contradict the shipped code.

The ticket proposed classic union rewrite rules (viewer = this | editor | parent->viewer). resolveEffectiveRelation does something else, deliberately: it walks up from the page, stops at the FIRST ancestor bearing any tuples, and answers from there exclusively — returning denied even when no tuple matches the caller, without ever consulting higher. Union inheritance would have silently widened access: with a parent locked to alice and a child locked to bob, alice is denied on the child today and would be allowed under union. Nothing in permissions.test.ts covers that case, so it would have shipped green.

Chosen: keep the current semantics, express them declaratively. The engine gains a nearestOverride rule kind alongside this and union, instead of the resolution order living in control flow. We depart from the Zanzibar paper on this one rule and record why.

Rejected — union plus an explicit blocked relation. This is the canonical option (exclusion IS in the Zanzibar paper, so it, not plain union, is 'the spec to the letter'). It keeps the ability to restrict a subtree, but makes exclusion nominative: privatising a page in a twenty-person workspace would mean listing everyone to exclude, where today placing a single grant excludes everyone else implicitly. That implicit lock is the feature. Cost also included migrating existing tuples and reworking the sharing UI.

Rejected — plain union. Removes the ability to restrict a subtree entirely and widens access on existing instances at deploy time.

Notion was checked and does not settle it: the official help centre documents 'broadest level of access' about sharing SCOPES (a workspace-wide grant beating a weaker individual one), not about the page tree, and says only that a subpage inherits and that this can be changed. Third-party guides claim downward restriction works. Weak, contradictory signal either way.

Everything else in this ticket stands unchanged: Policy module, CurrentUser tag, credential adapters, membership as tuples, deletion of withWorkspaceDb and the dead context resolver, migration of all four surfaces, unit-testable auth.

DECISION (membership storage) — revised mid-implementation, on evidence not available when the ticket was written.

The ticket called for workspace membership to become relation tuples. Counting the actual blast radius first: workspace_members is touched at 28 sites, including 4 JOINs (admin user list, admin workspace list, listMyWorkspaces, getWorkspaceMembers) and 5 test setups. It also sits in the PLATFORM database while acl_tuples is per-workspace, so workspace tuples would need a second platform-side tuple table.

Decisive point: deduplicating the five identical membership queries is achieved either way. A Membership module with a single query removes them just as structurally as tuples do. What tuples add beyond that is narrower than the ticket implied — uniform resolution of the workspace:<id>#member subject (today matched as a string in subjectsOf rather than looked up), and future nested teamspaces or guest relations becoming data instead of schema.

Chosen: a Membership module, storage unchanged. One membership query in the whole server, exposed as a relation at the interface. No data migration on the auth path in the week of a public launch.

Accepted debt, recorded rather than hidden: the workspace:<id>#member subject is still string-matched in subjectsOf instead of resolving through the same path as every other subject. Worth revisiting if nested teamspaces are ever built — that is the trigger, not a date.

CORRECTION to this ticket's own description: resolveWorkspaceContext is NOT dead. The exploration that produced this ticket reported zero callers; view-config-stream.ts:89 calls it, and it is the authorization path for the view-config SSE stream. Verified by grep before deleting anything.

What IS unused is the WorkspaceContext Tag beside it — declared, never provided, never consumed, because the function returns a plain object instead. The Tag goes; the function stays and gets migrated like every other surface.

Worth noting for the remaining tickets: this claim came from a subagent survey and was carried into the ticket text unchecked. Treat the file:line inventories in NOT-105 through NOT-122 as leads, not facts.
<!-- SECTION:NOTES:END -->
