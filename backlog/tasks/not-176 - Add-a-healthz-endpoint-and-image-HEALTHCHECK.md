---
id: NOT-176
title: Add a /healthz endpoint and image HEALTHCHECK
status: ready-for-agent
assignee: []
created_date: '2026-11-10T17:05:00Z'
labels:
  - enhancement
milestone: m-1
dependencies: []
priority: medium
ordinal: 148000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Why: orchestrators and uptime checks need a cheap liveness/readiness probe.
Agent brief: unauthenticated GET /healthz, no PII, outside the rate limiter; returns 200 JSON when the DB answers a trivial query, 503 otherwise. Wire it as the Dockerfile HEALTHCHECK.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 GET /healthz returns 200 and JSON status when the DB is reachable, without auth
- [ ] #2 Returns 503 when the DB query fails (tested)
- [ ] #3 Dockerfile HEALTHCHECK uses it; container reports healthy in docker ps
<!-- AC:END -->
