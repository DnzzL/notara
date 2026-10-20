---
id: NOT-131
title: Migrer les ~111 boutons restants vers ui/Button
status: done
assignee:
  - '@claude'
created_date: '2026-08-28 09:03'
updated_date: '2026-08-28 09:50'
labels:
  - enhancement
dependencies: []
priority: medium
ordinal: 126000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Après l'introduction des primitives (Button, Input, Tabs, MenuItem, Badge), 111 éléments <button> bruts subsistent — surtout BlockEditor (17), DatabaseView (7), CalendarView (7), ViewSwitcher (7). Chacun réimplémente à la main une variante existante.

Le test packages/app/test/design-tokens.test.ts garde les couleurs et les rayons mais n'impose pas l'usage des primitives : c'est une question de revue, pas de machine. Ce ticket est le rattrapage manuel.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 BlockEditor, DatabaseView, CalendarView et ViewSwitcher n'utilisent plus de <button> brut pour une action qu'une variante existante couvre
- [x] #2 bun run quickcheck et biome ci restent verts
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
ViewSwitcher 7→0, DatabaseView 7→0, CalendarView 4→1, BoardView 3→1, BlockEditor 17→14. Total app 111→90.

Ceux qui restent portent chacun une raison en commentaire, et aucun n'est couvert par une variante existante :
- les 11 bascules de format du bubble menu sont un jeu stylé par .bubble-menu button avec un état .active pressé — une barre d'outils, pas une variante ;
- .fab-add-block est un composant CSS ;
- les chips d'enregistrement (Calendar) et le pied de colonne pointillé (Board) sont des formes propres, pas des boutons ;
- les onglets de bandeau et les lignes de liste des vues mobiles sont des jeux stylés / des rangées pleine largeur.

Deux choses sont tombées de la migration :
- le contrôle de type de vue existait en trois exemplaires, dont deux gardaient un aplat encre pour le segment actif alors que le troisième était passé à l'accent. Un seul VIEW_TYPES et un seul <Tabs variant="toggle"> désormais ;
- ui/Button ne transmettait pas les refs, donc un popover ne pouvait pas s'ancrer à un bouton partagé. Corrigé.
<!-- SECTION:FINAL_SUMMARY:END -->
