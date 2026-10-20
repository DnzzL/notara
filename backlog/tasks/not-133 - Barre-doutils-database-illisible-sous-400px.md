---
id: NOT-133
title: Barre d'outils database illisible sous 400px
status: done
assignee:
  - '@claude'
created_date: '2026-08-28 09:20'
updated_date: '2026-08-28 09:43'
labels:
  - bug
dependencies: []
priority: medium
ordinal: 128000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Sur un écran de 390px, la barre au-dessus de chaque database (sélecteur de vue sauvegardée, segmented control Table/Board/Calendar, Filter, Sort, nom de la base) passe sur deux lignes et le nom de la base est tronqué contre le bord droit. Fonctionnel mais bâclé.

Constaté sur iPhone 14 émulé avec le template Project Tracker.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 La barre tient sur une ligne à 390px, ou se réorganise proprement
- [x] #2 Le nom de la database n'est plus tronqué
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
La barre d'outils passe en deux rangées sous 880px : le nom de la base devient un en-tête mono capitales sur sa propre ligne, les contrôles une rangée unique en scroll horizontal.

Implémenté en CSS seul, sans restructuration JSX : un wrapper .db-toolbar-controls en display:contents, donc invisible pour le layout desktop, qui devient le conteneur scrollable sous le breakpoint. Zéro risque de régression desktop.

Vérifié sur iPhone 14 émulé : barre à 67px sur deux rangées, nom complet ('SPRINTS', 'TASKS'), contrôles scrollables.
<!-- SECTION:FINAL_SUMMARY:END -->
