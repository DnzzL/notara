---
id: NOT-138
title: Ajouter footer d'agrégation aux vues database mobiles
status: done
assignee:
  - '@thomas'
created_date: '2026-08-30 14:50'
updated_date: '2026-08-30 14:52'
labels:
  - enhancement
dependencies: []
priority: medium
ordinal: 133000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
MobileRuler (vue database compacte/mobile) n'affiche aucun footer d'agrégation (sum/count/avg...), contrairement à la table desktop (DatabaseView.tsx tfoot). Ajouter l'équivalent mobile en gardant la cohérence graphique.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Footer d'agrégation visible dans MobileRuler comme en desktop
- [x] #2 Choix d'agrégation par colonne persiste comme en desktop (localStorage db-footer-aggs)
- [x] #3 Style cohérent avec le reste de l'UI mobile
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
MobileRuler affiche désormais un footer d'agrégation (Sum/Count/Avg/Min/Max...) pour le champ courant, calqué sur le tfoot desktop. AGG_LABEL déplacé dans lib/aggregate.ts (partagé desktop/mobile). État persisté via le même footerAggs/db-footer-aggs:${database.id} que le desktop — un choix d'agrégation sur un champ est vu identique sur les deux vues. Style: nouvelle classe .db-ruler-footer, cohérente avec .db-strip-caption (mono, sb bg, bordure). Fichiers: components/db/MobileRuler.tsx, components/DatabaseView.tsx, lib/aggregate.ts, styles.css.
<!-- SECTION:FINAL_SUMMARY:END -->
