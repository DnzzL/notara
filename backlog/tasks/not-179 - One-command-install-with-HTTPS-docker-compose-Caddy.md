---
id: NOT-179
title: One-command install with HTTPS (docker compose + Caddy)
status: ready-for-agent
assignee: []
created_date: '2026-11-11T13:21:00Z'
labels:
  - enhancement
milestone: m-3
dependencies: []
priority: high
ordinal: 152000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Why: self-hosters without TLS expertise stop at the plain-HTTP image. A compose file with Notara + Caddy (automatic TLS) makes 'domain + docker compose up -d' the whole install.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A docker-compose file runs Notara behind Caddy with automatic TLS for a configurable domain
- [ ] #2 On a fresh VM, the domain gets a valid certificate and /health returns 200 through Caddy
- [ ] #3 README has an install section: set domain, 'docker compose up -d', done
- [ ] #4 README steps were run once on a clean machine and worked as written
<!-- AC:END -->
