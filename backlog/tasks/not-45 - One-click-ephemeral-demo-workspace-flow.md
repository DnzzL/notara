---
id: NOT-45
title: One-click ephemeral demo workspace flow
status: ready-for-human
assignee: []
created_date: '2026-07-09 16:16'
updated_date: '2026-07-10 08:14'
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
- [ ] #1 The better-auth anonymous plugin is enabled ONLY when DEMO_MODE=true; non-demo installs see no behavior change with it off
- [ ] #2 The better-auth user-create hook early-returns for anonymous users, so demo visitors never fire the signup_completed funnel event or a welcome email to their fake address
- [ ] #3 A startDemo path (rejects unless DEMO_MODE=true) creates a workspace marked is_demo=1, seeds starter content, attaches the anonymous user as owner; it is idempotent per user (a second call in the same session returns the existing demo workspace) and uses a lowercased unique slug
- [ ] #4 The landing page shows a 'Try the live demo' button only when demo mode is advertised; clicking lands the visitor in a seeded demo workspace with no signup
- [ ] #5 isDemo is surfaced on the Workspace schema + toWorkspace + getMyWorkspaces so a dismissible 'temporary demo' banner renders after reload
- [ ] #6 DEMO_MODE, DEMO_TTL_HOURS, VITE_DEMO_MODE documented in README; both typechecks pass
- [ ] #7 Blocked by not-44
<!-- AC:END -->
