---
id: NOT-88
title: >-
  Demo mode is unreachable from the published image (VITE_DEMO_MODE is
  build-time)
status: needs-triage
assignee: []
created_date: '2026-08-05 15:08'
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
- [ ] #1 A visitor hitting an instance running the published image with DEMO_MODE=true sees the 'Try the live demo' CTA, with no image rebuild
- [ ] #2 A non-demo instance running the same image shows no CTA and exposes no anonymous sign-in endpoint
- [ ] #3 README's demo-mode section matches whatever env surface survives
<!-- AC:END -->
