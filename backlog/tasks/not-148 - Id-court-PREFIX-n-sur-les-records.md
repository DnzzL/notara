---
id: NOT-148
title: Id court PREFIX-n sur les records
status: done
assignee:
  - '@claude'
created_date: '2026-10-13 12:52'
updated_date: '2026-10-13 13:23'
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
- [x] #1 Un nouveau record reçoit le numéro suivant de sa database ; un numéro n'est jamais réutilisé, même après suppression
- [x] #2 L'id court est visible sur les cartes (board, table) et sur la page du record
- [x] #3 Les routes REST qui prennent un recordId acceptent aussi PREFIX-n
- [x] #4 Le préfixe est unique dans le workspace ; un doublon est refusé
- [x] #5 Les records existants reçoivent un numéro à la migration, par ordre de création
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- Migration 021 (atomique) : préfixe + compteur par database, numéro par record via trigger, backfill par nom et ordre de création.
- REST : :recordId résolu une seule fois dans registerOperations (PREFIX-n, insensible à la casse, scope :dbId).
- AC2 partiel : id court visible sur board, table, board mobile et RecordPanel ; pas sur la page pleine d'un record ouvert en page (nécessite un lien page→record côté UI).

- AC2 : RecordPanel retenu comme vue du record. La page pleine n'affiche rien de son record aujourd'hui ; besoin consigné à part.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Chaque record a un id court PREFIX-n (préfixe unique par database, numéro jamais réutilisé).
- Migration 021 atomique : colonnes, backfill par nom et ordre de création, index uniques, trigger de numérotation.
- Préfixe dérivé du nom à la création (handlers, templates, import Notion), modifiable via RPC/PATCH (400 format, 409 doublon).
- REST : tout :recordId accepte PREFIX-n, résolu dans registerOperations.
- UI : id court sur board, table, board mobile, RecordPanel.
Tests : test/short-id.test.ts (17), suites complètes vertes.
<!-- SECTION:FINAL_SUMMARY:END -->
