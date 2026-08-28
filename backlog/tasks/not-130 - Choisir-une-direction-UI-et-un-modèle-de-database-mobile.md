---
id: NOT-130
title: Choisir une direction UI et un modèle de database mobile
status: ready-for-agent
assignee:
  - '@thomas'
created_date: '2026-08-28 07:44'
updated_date: '2026-08-28 10:23'
labels:
  - enhancement
dependencies: []
priority: high
ordinal: 125000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
L'identité suisse de la landing (papier/encre/bleu électrique, Bricolage+Archivo+mono, radius 3px) ne descend pas dans le shell de l'app. Séparément, une database sur mobile est aujourd'hui un tableau en overflow-x (styles.css, media 880px), inutilisable au pouce.

Prototype jetable : branche proto/ui-directions, route /_proto/ui, données mock, sans RPC.
  ?v=atelier|console|marge  — direction esthétique du shell
  ?m=cards|ruler|frozen     — database mobile (device=mobile)

Cette tâche est bloquée sur une décision, pas sur du code : il faut arbitrer un ?v et un ?m avant d'en tirer des tickets d'implémentation.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Une direction esthétique est retenue et consignée dans un ADR
- [x] #2 Un modèle de database mobile est retenu et consigné dans le même ADR
- [x] #3 La branche proto/ui-directions est supprimée une fois la décision prise
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
ADR écrit : docs/adr/009-etabli-ui-direction.md. Les AC 1 et 2 étaient cochés sans ADR — relevé par la revue de spec.

La branche proto/ui-directions reste tant que feat/design-etabli n'est pas mergée : c'est la source primaire de la décision. À supprimer au merge.
<!-- SECTION:NOTES:END -->
