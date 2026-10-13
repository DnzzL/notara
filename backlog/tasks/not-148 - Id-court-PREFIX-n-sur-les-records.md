---
id: NOT-148
title: Id court PREFIX-n sur les records
status: ready-for-agent
assignee: []
created_date: '2026-10-13 12:52'
labels:
  - enhancement
dependencies: []
references:
  - specs/shared-backlog.md
  - docs/adr/012-notara-is-a-queue-backend.md
priority: medium
ordinal: 143000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Chaque database a un préfixe (unique dans le workspace) et un compteur ; chaque record reçoit un numéro séquentiel jamais réutilisé. Humains et runners désignent une carte par PREFIX-n (ex. NOT-12) au lieu d'un id opaque.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Un nouveau record reçoit le numéro suivant de sa database ; un numéro n'est jamais réutilisé, même après suppression
- [ ] #2 L'id court est visible sur les cartes (board, table) et sur la page du record
- [ ] #3 Les routes REST qui prennent un recordId acceptent aussi PREFIX-n
- [ ] #4 Le préfixe est unique dans le workspace ; un doublon est refusé
- [ ] #5 Les records existants reçoivent un numéro à la migration, par ordre de création
<!-- AC:END -->
