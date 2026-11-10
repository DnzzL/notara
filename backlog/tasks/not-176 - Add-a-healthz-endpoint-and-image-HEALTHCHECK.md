---
id: NOT-176
title: Make /health check the DB and back a Docker HEALTHCHECK
status: ready-for-agent
assignee: []
created_date: '2026-11-10T17:05:00Z'
updated_date: '2026-11-10T17:08:00Z'
labels:
  - enhancement
milestone: m-1
dependencies: []
priority: medium
ordinal: 148000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Why: orchestrators need a real readiness probe. GET /health already exists (packages/server/src/index.ts, plain 'ok', used by Electron and BackupsPanel): extend it, do not add /healthz. The Dockerfile has no HEALTHCHECK today.
Agent brief: unauthenticated /health runs a trivial DB query; 200 when OK (keep body compatible with existing callers), 503 otherwise; no PII; outside the rate limiter. Wire it as the Dockerfile HEALTHCHECK.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Returns 503 when the DB query fails (tested)
- [ ] #2 Dockerfile HEALTHCHECK uses it; container reports healthy in docker ps
- [ ] #3 GET /health returns 200 when the DB is reachable, existing callers (Electron, BackupsPanel) keep working
<!-- AC:END -->
