---
id: NOT-159
title: Commenter une carte par son id via l'API
status: done
assignee:
  - '@claude'
created_date: '2026-10-13 16:02'
updated_date: '2026-10-13 18:26'
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
- [x] #1 GET et POST /databases/:dbId/records/:recordId/comments lisent et écrivent le fil de la carte (id ou id court)
- [x] #2 POST crée la page de la carte si elle n'existe pas encore
- [x] #3 Mêmes règles que les commentaires de page : auteur, nom de clé, mentions, boîte, clé read refusée
- [x] #4 Les opérations figurent dans le document OpenAPI
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
GET|POST records/:recordId/comments ; POST ouvre la page (openRecordAsPage) puis addComment ; viewer sur la base.
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
GET|POST /databases/:dbId/records/:recordId/comments (id ou id court). POST ouvre la page de la carte au besoin, puis mêmes règles que les commentaires de page. Droit : viewer sur la base ; carte d'une autre base → 404. Tests : comments.test.ts (6), parité OpenAPI.
<!-- SECTION:FINAL_SUMMARY:END -->
