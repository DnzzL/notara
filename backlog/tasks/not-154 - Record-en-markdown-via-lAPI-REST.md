---
id: NOT-154
title: Record en markdown via l'API REST
status: ready-for-agent
assignee: []
created_date: '2026-10-13 12:53'
labels:
  - enhancement
dependencies:
  - NOT-148
references:
  - specs/shared-backlog.md
priority: medium
ordinal: 149000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Un runner obtient une carte complète en un appel : titre, valeurs de champs, corps markdown et critères d'acceptation (blocs todo).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 GET d'un record avec format=markdown renvoie titre, valeurs de champs lisibles, corps en markdown
- [ ] #2 La réponse liste les critères [{text, checked}] tirés des blocs todo de la page du record
- [ ] #3 Fonctionne avec l'id ou l'id court
- [ ] #4 Le format figure dans le document OpenAPI
<!-- AC:END -->
