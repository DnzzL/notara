---
id: NOT-98
title: Surface a source link inside the app (AGPL section 13)
status: ready-for-agent
assignee: []
created_date: '2026-08-19 15:53'
labels:
  - enhancement
dependencies: []
priority: medium
ordinal: 93000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
AGPL section 13 expects users who interact with the program over a network to be able to get its source. The landing page links the repository, but a logged-in user on a self-hosted instance has no such link — and on a modified instance the operator's obligation is to point at their source, not ours. Settings needs an About row with the version, the licence, and a source URL that an operator can override.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Settings shows version, licence (AGPL-3.0-or-later) and a link to the source
- [ ] #2 The source URL is overridable by env var so an operator can point at their own fork
- [ ] #3 The link is reachable without leaving the app shell
<!-- AC:END -->
