---
id: NOT-164
title: 'llms.txt : le cycle d''une carte pour les agents'
status: ready-for-agent
assignee: []
created_date: '2026-10-13 16:02'
labels:
  - enhancement
dependencies:
  - NOT-159
  - NOT-160
  - NOT-161
references:
  - docs/shared-backlog.md
  - docs/adr/013-artifacts-run-isolated.md
priority: medium
ordinal: 159000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Un agent qui découvre une instance Notara trouve en une lecture comment travailler une carte, sans parcourir toute l'OpenAPI.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 GET /llms.txt décrit le cycle d'une carte (lister, lire, commenter, cocher, clore, créer) en appels concrets
- [ ] #2 Il renvoie à /api/v1/openapi.json et à la doc du backlog partagé
- [ ] #3 Il énonce la règle des artefacts : tout en inline, pas de réseau
- [ ] #4 Il ne nomme aucun runner
<!-- AC:END -->
