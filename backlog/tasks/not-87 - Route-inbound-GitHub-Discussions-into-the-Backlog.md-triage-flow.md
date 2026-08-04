---
id: NOT-87
title: Route inbound GitHub Discussions into the Backlog.md triage flow
status: needs-triage
assignee: []
created_date: '2026-08-04 18:39'
labels:
  - enhancement
dependencies: []
priority: low
ordinal: 82000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
GitHub Discussions was enabled on DnzzL/notara as part of the pre-launch discoverability pass, creating a public inbound surface with no documented triage routing. The repo uses Backlog.md as the sole triage surface (no GitHub Issues, PRs are not a triage surface), so Discussions threads currently land nowhere. Decide and document how inbound Discussions become backlog tasks.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A documented rule exists (in docs/agents/issue-tracker.md) stating how a Discussion thread becomes a backlog task, and who/what does the transfer
- [ ] #2 Discussions categories are configured to match that rule rather than the GitHub defaults
<!-- AC:END -->
