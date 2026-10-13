---
id: NOT-150
title: Commentaires via l'API REST
status: ready-for-agent
assignee: []
created_date: '2026-10-13 12:53'
labels:
  - enhancement
dependencies:
  - NOT-149
references:
  - specs/shared-backlog.md
priority: medium
ordinal: 145000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Un runner lit et écrit les commentaires d'une page avec une clé API.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 GET liste les commentaires d'une page, du plus ancien au plus récent
- [ ] #2 POST ajoute un commentaire ; la réponse porte l'auteur (utilisateur de la clé) et le nom de la clé
- [ ] #3 Une clé en lecture seule ne peut pas commenter
- [ ] #4 Les opérations figurent dans le document OpenAPI
<!-- AC:END -->
