---
id: NOT-130
title: Choisir une direction UI et un modèle de database mobile
status: ready-for-agent
assignee:
  - '@thomas'
created_date: '2026-08-28 07:44'
updated_date: '2026-08-28 08:39'
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
- [ ] #3 La branche proto/ui-directions est supprimée une fois la décision prise
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Décision prise en revue du prototype (branche proto/ui-directions).

- Direction retenue : Établi (?v=etabli) — base Console (densité, calme), discipline typographique empruntée à Atelier, accent bleu électrique conservé.
- Atelier seul écarté : trop chargé pour un produit orienté focus.
- Database mobile retenue : ruler (?m=ruler) — on navigue le champ, pas la ligne.

Reste à faire : plan de migration, mise à jour de docs/design-system.md, implémentation.

Implémenté sur la branche feat/design-etabli (46205b6). Validé via agent-browser en mode DEMO_MODE : desktop 1440px et iPhone 14 (390px), édition mobile de bout en bout.
<!-- SECTION:NOTES:END -->
