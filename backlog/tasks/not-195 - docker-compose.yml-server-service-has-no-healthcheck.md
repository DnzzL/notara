---
id: NOT-195
title: 'docker-compose.yml: server service has no healthcheck'
status: needs-triage
assignee: []
created_date: '2026-11-12T21:08:00Z'
labels:
  - enhancement
dependencies: []
priority: low
ordinal: 163000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
docker-compose.yml builds packages/server/Dockerfile (no HEALTHCHECK) and its healthcheck block is commented out, so the stack reports no health. Found in NA-48.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 docker compose ps shows the server service healthy
<!-- AC:END -->
