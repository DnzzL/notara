---
id: NOT-159
title: Commenter une carte par son id via l'API
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
ordinal: 154000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Un agent ne peut pas commenter une carte créée via l'API : les commentaires sont attachés à la page du record, qui n'existe qu'une fois la carte ouverte. Le fil d'une carte doit être adressable par la carte.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 GET et POST /databases/:dbId/records/:recordId/comments lisent et écrivent le fil de la carte (id ou id court)
- [ ] #2 POST crée la page de la carte si elle n'existe pas encore
- [ ] #3 Mêmes règles que les commentaires de page : auteur, nom de clé, mentions, boîte, clé read refusée
- [ ] #4 Les opérations figurent dans le document OpenAPI
<!-- AC:END -->
