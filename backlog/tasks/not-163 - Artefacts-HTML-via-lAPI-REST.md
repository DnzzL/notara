---
id: NOT-163
title: Artefacts HTML via l'API REST
status: ready-for-agent
assignee: []
created_date: '2026-10-13 16:02'
labels:
  - enhancement
dependencies:
  - NOT-162
references:
  - docs/adr/013-artifacts-run-isolated.md
priority: medium
ordinal: 158000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Un agent joint son rapport HTML à une carte en un appel, et le régénère au même endroit.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 POST /pages/:pageId/artifacts ajoute un artefact (corps = le HTML, nom en paramètre) en fin de page et renvoie son id
- [ ] #2 PUT /artifacts/:id remplace le contenu
- [ ] #3 La réponse liste les hôtes externes qui ne se chargeront pas (blockedHosts)
- [ ] #4 Plus de 5 Mo, ou une clé read, est refusé ; l'accès suit celui de la page
- [ ] #5 Les opérations figurent dans le document OpenAPI
<!-- AC:END -->
