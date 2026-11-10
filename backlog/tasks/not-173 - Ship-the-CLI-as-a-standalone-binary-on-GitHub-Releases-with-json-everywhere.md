---
id: NOT-173
title: Ship the CLI as a standalone binary on GitHub Releases with --json everywhere
status: ready-for-agent
assignee: []
created_date: '2026-11-10T17:05:00Z'
labels:
  - enhancement
milestone: m-0
dependencies: []
priority: medium
ordinal: 145000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Depends on PR #33 (feat/agent-ready-ops: typed operation table behind REST, OpenAPI, MCP, CLI) landing first.
Why: agents and scripts should use the CLI without installing Bun or the repo.
Agent brief: build with 'bun build --compile' per target (darwin arm64/x64, linux arm64/x64), attach to the GitHub Release with a SHA256SUMS file from the release workflow. Every CLI command gets a --json flag emitting machine-readable output (derive it from the operation output schema).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Release workflow attaches CLI binaries for darwin and linux (arm64, x64) plus SHA256SUMS
- [ ] #2 'sha256sum -c SHA256SUMS' passes on a downloaded release
- [ ] #3 Every CLI command accepts --json and prints valid JSON only on stdout
- [ ] #4 A test iterates all CLI commands and fails if one lacks --json (extends cli-parity)
<!-- AC:END -->
