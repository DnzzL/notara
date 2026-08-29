---
id: NOT-136
title: CI never builds packages/app
status: needs-triage
assignee: []
created_date: '2026-08-29 17:33'
labels:
  - bug
dependencies: []
priority: medium
ordinal: 131000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
ci.yml runs install, shared build, typecheck, tests and e2e — but never 'bun run --filter @notara/app build'. The only place vite build runs is the Docker image build at release time. A build-only breakage (a bad vite plugin option, a missing patch step, an unresolvable import) therefore reaches release before anything reports it. Found while fixing NOT-135, where the local build failed for three unrelated pre-existing reasons and there was no green reference to compare against.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 CI builds packages/app on every push
<!-- AC:END -->
