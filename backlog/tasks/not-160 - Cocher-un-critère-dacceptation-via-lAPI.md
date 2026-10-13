---
id: NOT-160
title: Cocher un critère d'acceptation via l'API
status: ready-for-agent
assignee: []
created_date: '2026-10-13 16:02'
labels:
  - enhancement
dependencies: []
references:
  - specs/shared-backlog.md
  - docs/shared-backlog.md
priority: high
ordinal: 155000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Un agent lit les critères d'une carte mais ne peut pas en cocher un précis : la réponse ne porte pas l'identité du critère, et cocher demande d'écrire le HTML de l'éditeur.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Chaque critère de GET record porte un id stable
- [ ] #2 Un appel coche ou décoche un critère par son id, sans HTML à écrire
- [ ] #3 Le corps markdown et l'éditeur reflètent le changement
- [ ] #4 Les opérations figurent dans le document OpenAPI
<!-- AC:END -->
