---
id: NOT-179
title: One-command install with HTTPS (docker compose + Caddy)
status: ready-for-agent
assignee: []
created_date: '2026-11-11T13:21:00Z'
updated_date: '2026-11-11T13:33:00Z'
labels:
  - enhancement
milestone: m-3
dependencies: []
priority: high
ordinal: 152000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Why: self-hosters without TLS expertise stop at the plain-HTTP image. Extend the existing docker-compose.yml (README 'Docker Compose' section) with Caddy (automatic TLS) so 'domain + docker compose up -d' is the whole install. The fresh-VM and clean-machine ACs need a real domain and VM: the agent prepares them, a human confirms.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A docker-compose file runs Notara behind Caddy with automatic TLS for a configurable domain
- [ ] #2 On a fresh VM, the domain gets a valid certificate and /health returns 200 through Caddy
- [x] #3 README has an install section: set domain, 'docker compose up -d', done
- [ ] #4 README steps were run once on a clean machine and worked as written
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Compose: notara image + caddy, Caddyfile, README install. Proven locally with DOMAIN=localhost. AC2/AC4 need real VM+domain: human confirms.
<!-- SECTION:NOTES:END -->
