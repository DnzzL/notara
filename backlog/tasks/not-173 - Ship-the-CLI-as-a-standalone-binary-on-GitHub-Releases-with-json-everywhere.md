---
id: NOT-173
title: Ship the CLI as a standalone binary on GitHub Releases
status: ready-for-agent
assignee: []
created_date: '2026-11-10T17:05:00Z'
updated_date: '2026-11-10T17:08:00Z'
labels:
  - enhancement
milestone: m-0
dependencies: []
priority: medium
ordinal: 145000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Depends on PR #33 (feat/agent-ready-ops) landing first.
Why: agents and scripts should use the CLI without installing Bun or the repo. The CLI already has --json on every command; this ticket does not change that.
Agent brief: build with 'bun build --compile' per target (darwin arm64/x64, linux arm64/x64), attach to the GitHub Release with a SHA256SUMS file from the release workflow (.github/workflows/release.yml).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Release workflow attaches CLI binaries for darwin and linux (arm64, x64) plus SHA256SUMS
- [ ] #2 'sha256sum -c SHA256SUMS' passes on a downloaded release
<!-- AC:END -->
