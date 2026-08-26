---
id: NOT-124
title: 'API keys are all-or-nothing: no scopes on a published REST API'
status: needs-triage
assignee: []
created_date: '2026-08-26 13:28'
labels:
  - enhancement
dependencies: []
priority: medium
ordinal: 119000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
An API key authenticates as its owner and carries every right that user has. There is no scope column on api_keys and no scope check anywhere, so a key handed to a CI job, a script or a third-party integration can delete workspaces just as readily as it can list pages.

That is a normal limitation for an internal token and an awkward one for a published REST API shipped with a CLI, which is what /api/v1 becomes at launch. 'Give me a read-only key' is the first thing an integrator asks for.

Surfaced while deciding what to take from the composable policy pattern in NOT-104. Relations cannot express this: a scope is a property of the CREDENTIAL, not of the user's relationship to a resource. This is the one case in the codebase that would genuinely want the domain:action permission vocabulary that NOT-104 deliberately left out — permissions carried on the principal, which is exactly what an API key is.

The Policy module is already shaped for it: CurrentUser would gain a scopes field and a scope(...) policy would sit alongside the relation policies, composed with all(). No restructuring needed, which is why this was left out rather than built speculatively.

Worth deciding before the REST API is advertised, since adding scopes afterwards means either breaking existing keys or grandfathering them as unscoped forever.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A key can be created with a scope narrower than its owner's rights, at minimum read-only versus full
- [ ] #2 Scope is enforced for every REST operation, not only the ones remembered at review time
- [ ] #3 Keys created before scopes existed keep working, with their treatment stated explicitly rather than left implicit
- [ ] #4 The scope a key carries is visible in the key list so its holder can tell what it can do
<!-- AC:END -->
