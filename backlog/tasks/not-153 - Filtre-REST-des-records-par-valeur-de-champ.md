---
id: NOT-153
title: Filtre REST des records par valeur de champ
status: ready-for-agent
assignee: []
created_date: '2026-10-13 12:53'
labels:
  - enhancement
dependencies: []
references:
  - specs/shared-backlog.md
priority: medium
ordinal: 148000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Un runner liste seulement les cartes d'un statut ou d'un agent donné, sans tout télécharger.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 La liste des records accepte un ou plusieurs couples champ=valeur, combinés en ET
- [ ] #2 Un champ inconnu renvoie une erreur 400 explicite
- [ ] #3 Le filtre figure dans le document OpenAPI
<!-- AC:END -->
