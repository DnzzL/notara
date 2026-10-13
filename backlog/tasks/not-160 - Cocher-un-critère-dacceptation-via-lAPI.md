---
id: NOT-160
title: Cocher un critère d'acceptation via l'API
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
ordinal: 155000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Un agent lit les critères d'une carte mais ne peut pas en cocher un précis : la réponse ne porte pas l'identité du critère, et cocher demande d'écrire le HTML de l'éditeur.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Chaque critère de GET record porte un id stable
- [x] #2 Un appel coche ou décoche un critère par son id, sans HTML à écrire
- [x] #3 Le corps markdown et l'éditeur reflètent le changement
- [x] #4 Les opérations figurent dans le document OpenAPI
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
id critère = <blockId>:<n> ; PUT records/:recordId/criteria/:criterionId {checked} réécrit data-checked du n-ième item ; editor sur la base.
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
criteria[] porte id = <blockId>:<n>. PUT …/records/:recordId/criteria/:criterionId {checked} réécrit l'item et sa case. Corps markdown et éditeur (au rechargement) à jour. Corrige au passage les sous-listes de to-dos TipTap aplaties dans le markdown. Tests : record-markdown.test.ts (7).
<!-- SECTION:FINAL_SUMMARY:END -->
