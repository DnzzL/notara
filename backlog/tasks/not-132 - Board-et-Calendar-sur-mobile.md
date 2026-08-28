---
id: NOT-132
title: Board et Calendar sur mobile
status: ready-for-agent
assignee:
  - '@claude'
created_date: '2026-08-28 09:20'
updated_date: '2026-08-28 09:22'
labels:
  - enhancement
dependencies: []
priority: medium
ordinal: 127000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
La table a son traitement mobile (le field ruler). Board et Calendar n'en ont pas : sous 880px ils gardent leur rendu desktop. Le Board a des colonnes en scroll horizontal qui passent mal au pouce ; le Calendar affiche une grille mensuelle illisible à 390px.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Board et Calendar ont un rendu adapté sous 880px, ou sont explicitement redirigés vers la vue Table avec un message
<!-- AC:END -->
