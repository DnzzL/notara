---
id: NOT-90
title: 'Docker: package images ran bun install with lifecycle scripts'
status: done
assignee: []
created_date: '2026-08-06 07:57'
updated_date: '2026-08-06 07:57'
labels:
  - bug
dependencies: []
priority: medium
ordinal: 85000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
packages/server/Dockerfile and packages/app/Dockerfile ran a plain 'bun install', so the container executed both the root postinstall (npx simple-git-hooks, which needs a .git dir the build context excludes) and simple-git-hooks' own postinstall, which aborts with ENOENT on its package.json under the bun version in oven/bun:1. The root Dockerfile had already been fixed this way in b6c6474; these two were missed. Reproduced and fixed on 2026-08-06.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 packages/server/Dockerfile and packages/app/Dockerfile install with --ignore-scripts and apply the msgpackr patch explicitly via bun run apply-patches
- [x] #2 docker build succeeds for all three Dockerfiles and the server image answers /health
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
packages/server/Dockerfile and packages/app/Dockerfile now install with --ignore-scripts and run 'bun run apply-patches' explicitly, matching what the root Dockerfile already did since b6c6474.

Cause: a plain 'bun install' in the image ran simple-git-hooks' own postinstall, which crashes with ENOENT on its package.json under bun 1.3.14 in oven/bun:1 — and the root postinstall's 'npx simple-git-hooks' needs a .git dir the build context excludes. Neither belongs in an image build; the msgpackr patch does.

Verified: reproduced the failure with and without the recently added @effect/tsgo devDependency (pre-existing, unrelated), then built all three Dockerfiles green and smoke-tested the server image (GET /health -> ok).
<!-- SECTION:FINAL_SUMMARY:END -->
