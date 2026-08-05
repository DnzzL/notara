---
id: NOT-88
title: >-
  Demo mode is unreachable from the published image (VITE_DEMO_MODE is
  build-time)
status: done
assignee:
  - '@agent'
created_date: '2026-08-05 15:08'
updated_date: '2026-08-05 15:23'
labels:
  - bug
dependencies: []
priority: high
ordinal: 83000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
LandingPage.tsx:10 reads import.meta.env.VITE_DEMO_MODE, which Vite inlines at build time. The root Dockerfile has no ARG/ENV for it and runs 'cd packages/app && bun run build' with nothing set, so the GHCR image ships with the demo CTA compiled out. Setting DEMO_MODE=true at runtime enables the server-side startDemo endpoint but the button never renders, making the hosted demo (NOT-45) impossible to deploy from the published image without a custom rebuild. Options: (a) add ARG VITE_DEMO_MODE to the Dockerfile and publish a second demo-tagged image, or (b) move the flag to runtime by exposing it from the server (a /api/settings-style GET already exists) and dropping VITE_DEMO_MODE entirely, so one image serves both modes and the documented env surface shrinks from 3 vars to 2.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A visitor hitting an instance running the published image with DEMO_MODE=true sees the 'Try the live demo' CTA, with no image rebuild
- [x] #2 A non-demo instance running the same image shows no CTA and exposes no anonymous sign-in endpoint
- [x] #3 README's demo-mode section matches whatever env surface survives
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add GET /api/public-config exposing only { demoMode } -- deliberately not /api/settings
2. Fetch it in the / route loader, pass demoMode to LandingPage as a prop
3. Drop VITE_DEMO_MODE from LandingPage, the auth-client comment and the README
4. Verify one binary serves both modes by booting with and without DEMO_MODE
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Moved demo-mode advertising from build time to runtime, so the published GHCR image serves demo and non-demo instances without a rebuild.

Changes:
- New GET /api/public-config returning only { demoMode }. Deliberately a separate route rather than an addition to GET /api/settings, which is unauthenticated and returns S3 credentials.
- The / route loader fetches it and passes demoMode to LandingPage as a prop; the fetch defaults to false on failure.
- VITE_DEMO_MODE is gone from LandingPage, the auth-client comment and the README. The documented demo env surface is now DEMO_MODE + DEMO_TTL_HOURS.
- Fixed a second redirect hole found while here: a visitor holding only a demo workspace was redirected to /workspaces instead of the landing page.

Verified by booting the same binary twice: DEMO_MODE unset gives {"demoMode":false} and 404 on /api/auth/sign-in/anonymous; DEMO_MODE=true gives {"demoMode":true} and 200.

Supersedes the VITE_DEMO_MODE parts of NOT-45 AC #4 and #6; that ticket's record is left as it was.

Tests: both typechecks clean, 133 server tests pass.
<!-- SECTION:FINAL_SUMMARY:END -->
