---
id: NOT-133
title: Barre d'outils database illisible sous 400px
status: ready-for-agent
assignee:
  - '@claude'
created_date: '2026-08-28 09:20'
updated_date: '2026-08-28 09:22'
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
- [ ] #1 La barre tient sur une ligne à 390px, ou se réorganise proprement
- [ ] #2 Le nom de la database n'est plus tronqué
<!-- AC:END -->
