---
id: NOT-175
title: Publish a multi-arch image (amd64 + arm64) to ghcr
status: ready-for-agent
assignee: []
created_date: '2026-11-10T17:05:00Z'
labels:
  - enhancement
milestone: m-1
dependencies: []
priority: medium
ordinal: 147000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Why: Raspberry Pi / Apple-silicon / ARM VPS self-hosters must 'docker run' without emulation.
Agent brief: extend the release workflow with buildx + QEMU, publish ghcr.io image manifest for linux/amd64 and linux/arm64, tag version and latest.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Release publishes one ghcr tag whose manifest lists linux/amd64 and linux/arm64
- [ ] #2 'docker buildx imagetools inspect' output shows both platforms (recorded in PR)
- [ ] #3 README self-host snippet uses the ghcr image
<!-- AC:END -->
