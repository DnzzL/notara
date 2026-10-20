---
id: NOT-45
title: One-click ephemeral demo workspace flow
status: done
assignee:
  - '@agent'
created_date: '2026-07-09 16:16'
updated_date: '2026-08-04 18:51'
labels:
  - enhancement
dependencies: []
ordinal: 48000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The visitor-facing 'try before you clone' flow: a landing-page button creates an isolated, throwaway, no-signup demo workspace (seeded) that auto-expires via the purge job. Detailed spec: plans/004-ephemeral-demo-workspaces.md. NEEDS HUMAN VALIDATION because it enables anonymous authentication (better-auth anonymous plugin) — env-gated OFF by default (DEMO_MODE / VITE_DEMO_MODE), but turning on anonymous sign-in is a security-posture decision. Blocked by not-44 so purge exists before demo creation goes live.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The better-auth anonymous plugin is enabled ONLY when DEMO_MODE=true; non-demo installs see no behavior change with it off
- [x] #2 The better-auth user-create hook early-returns for anonymous users, so demo visitors never fire the signup_completed funnel event or a welcome email to their fake address
- [x] #3 A startDemo path (rejects unless DEMO_MODE=true) creates a workspace marked is_demo=1, seeds starter content, attaches the anonymous user as owner; it is idempotent per user (a second call in the same session returns the existing demo workspace) and uses a lowercased unique slug
- [x] #4 The landing page shows a 'Try the live demo' button only when demo mode is advertised; clicking lands the visitor in a seeded demo workspace with no signup
- [x] #5 isDemo is surfaced on the Workspace schema + toWorkspace + getMyWorkspaces so a dismissible 'temporary demo' banner renders after reload
- [x] #6 DEMO_MODE, DEMO_TTL_HOURS, VITE_DEMO_MODE documented in README; both typechecks pass
- [x] #7 Blocked by not-44
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Server:
1. auth.ts: import anonymous from better-auth/plugins/anonymous; plugins: DEMO_MODE ? [anonymous()] : []. databaseHooks.user.create.after early-returns when user.isAnonymous, so no signup_completed track() and no welcome email to the fake address.
2. shared/schema.ts: add isDemo: Schema.Boolean to Workspace; shared/api.ts: Rpc.make('startDemo', { success: Workspace }).
3. handlers/workspaces.ts: WorkspaceRow gains is_demo; toWorkspace maps isDemo; new startDemo(userId) that fails unless DEMO_MODE, returns the caller's existing is_demo=1 workspace when there is one (idempotent per user), else inserts one with a lowercased unique slug demo-<ulid lowercased> and owner membership. Returns { workspace, created } so the RPC handler seeds only on first creation.
4. rpc-handlers.ts: startDemo handler — getSessionUser, call Workspaces.startDemo, seed starter content when created (same tolerant pattern as createWorkspace).

App:
5. auth-client.ts: add anonymousClient() (purely declarative — adds typed endpoints, issues no requests) so authClient.signIn.anonymous types.
6. LandingPage: DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true'; render a 'Try the live demo' hero CTA only then; click => signIn.anonymous() then api.startDemo() then navigate to the workspace.
7. DemoBanner component rendered in $workspaceSlug when routeContext.workspace.isDemo; dismissible.

Docs/verify:
8. README env section: DEMO_MODE, DEMO_TTL_HOURS, VITE_DEMO_MODE (done last — README is being edited concurrently).
9. Verify: bun --bun tsc --noEmit -p packages/server, -p packages/app, bun test packages/server/test. Add startDemo tests to test/workspaces.test.ts.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- auth.ts: plugins = demoMode() ? [anonymous()] : []. Runtime-verified both ways — POST /api/auth/sign-in/anonymous returns 404 without DEMO_MODE and 200 with it, and auth.api has no anonymous endpoints when off.
- auth.ts user.create.after early-returns on user.isAnonymous before track('signup_completed') and the welcome email. Verified the plugin persists isAnonymous=1 on the created row, so the guard fires.
- shared: Workspace gains isDemo: Schema.Boolean; new Rpc.make('startDemo', { success: Workspace }).
- handlers/workspaces.ts: toWorkspace maps is_demo -> isDemo (so getMyWorkspaces surfaces it); startDemo(userId) fails unless demoMode(), returns the caller's existing is_demo=1 workspace when present, else inserts one with slug demo-<lowercased ulid> plus owner membership. Returns { workspace, created } so the RPC handler seeds only on first creation.
- rpc-handlers.ts: startDemo handler seeds starter content via the same tolerant Onboarding path as createWorkspace.
- app: auth-client adds anonymousClient() (declarative only — it registers typed endpoints and issues no requests); LandingPage gates a 'Try the live demo' hero button on import.meta.env.VITE_DEMO_MODE and runs signIn.anonymous() -> api.startDemo() -> navigate; new DemoBanner rendered in $workspaceSlug when routeContext.workspace.isDemo, plus .demo-banner styles.
- README: new collapsible 'Hosted demo mode' block in the Configuration section documenting DEMO_MODE / DEMO_TTL_HOURS / VITE_DEMO_MODE. Added last and scoped to that section since README was being edited concurrently.
- Tests: 4 new startDemo cases in test/workspaces.test.ts (rejected when off, lowercased slug + owner membership, idempotent per user, getMyWorkspaces surfaces isDemo).
- Note: plans/004-ephemeral-demo-workspaces.md referenced by the description does not exist in the repo; implemented against the ACs.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Adds the visitor-facing 'try before you clone' flow on top of the NOT-44 purge, entirely behind DEMO_MODE / VITE_DEMO_MODE.

Server:
- auth.ts enables the better-auth anonymous plugin only when DEMO_MODE=true (plugins list is empty otherwise). The user-create hook early-returns for anonymous users so demo visitors fire no signup_completed event and get no welcome email at their generated throwaway address.
- handlers/workspaces.ts gains startDemo(userId): rejects unless DEMO_MODE, idempotent per user (returns the demo workspace the caller already owns), otherwise inserts a workspace with is_demo=1, a lowercased unique slug (demo-<ulid>), and owner membership. toWorkspace now maps is_demo to isDemo, so getMyWorkspaces surfaces it everywhere.
- rpc-handlers.ts adds the startDemo RPC, seeding starter content on first creation with the same tolerant pattern as createWorkspace.
- shared: Workspace.isDemo and the startDemo RPC.

App:
- LandingPage shows a 'Try the live demo' hero CTA only when VITE_DEMO_MODE=true; it signs in anonymously, calls startDemo, and navigates into the seeded workspace with no signup.
- DemoBanner renders a dismissible 'temporary demo workspace' strip in the workspace layout whenever the route context's workspace has isDemo, so it appears after a reload too.
- auth-client registers anonymousClient(), which is declarative: it adds the typed /sign-in/anonymous call and issues no requests of its own.

Security posture: verified the gate end to end rather than assuming it. With DEMO_MODE unset, auth.api exposes no anonymous endpoints and POST /api/auth/sign-in/anonymous returns 404; with DEMO_MODE=true it returns 200 and writes isAnonymous=1. A non-demo install therefore sees no behavior change — the only unconditional footprint is the user.isAnonymous column added by the NOT-44 migration, which AC #2 of that task required.

Docs: README Configuration section documents DEMO_MODE, DEMO_TTL_HOURS and VITE_DEMO_MODE, with an explicit warning that enabling it turns on anonymous authentication.

Verification: bun --bun tsc --noEmit -p packages/server clean; bun --bun tsc --noEmit -p packages/app clean; bun test packages/server/test = 133 pass / 0 fail (4 new startDemo tests).
<!-- SECTION:FINAL_SUMMARY:END -->
