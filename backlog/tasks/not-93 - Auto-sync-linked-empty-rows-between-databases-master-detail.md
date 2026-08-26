---
id: NOT-93
title: 'Auto-sync: linked empty rows between databases (master-detail)'
status: ready-for-agent
assignee: []
created_date: '2026-08-12 08:06'
updated_date: '2026-08-12 08:12'
labels:
  - enhancement
dependencies: []
priority: medium
ordinal: 88000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Option opt-in au niveau d'une base satellite (ex. Repas, Logistique) : chaque enregistrement de la base maître (ex. Invités) force l'existence d'une ligne vide liée via la relation, pour que toutes les bases aient le même nombre de lignes. Réglage sur la base satellite (champ relation vers le maître). Approche A validée avec Thomas le 2026-08-11 : lignes physiques synchronisées + backfill + cascade, plutôt que lignes virtuelles (vision future).

Blocked by : None — can start immediately.

Contrainte de scope : la synchronisation ne s'applique qu'aux relations un-à-un (1 invité = 1 ligne Repas). Les relations many-to-many (ex. Tables.Membres) ne doivent PAS être synchronisées. Le modèle de données n'a pas de notion 1:1 sur les relations aujourd'hui : décision de design à acter pendant l'implémentation (réglage par base qui documente le 1:1, ou drapeau 'un-à-un' sur le champ relation). Comportement si plusieurs lignes enfants existent déjà pour un même maître : à définir (ne pas dupliquer à la création).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Réglage opt-in au niveau d'une base satellite : 'Synchroniser avec [base maître] via la relation [champ]'
- [ ] #2 Créer un enregistrement dans la base maître crée automatiquement une ligne vide liée (relation remplie) dans chaque base synchronisée, dans le même appel (transactionnel)
- [ ] #3 Activer le réglage déclenche un backfill : crée les lignes manquantes pour les enregistrements maîtres existants
- [ ] #4 Supprimer/restaurer un enregistrement maître cascade sur les lignes enfants (respecte la corbeille)
- [ ] #5 Le titre de la ligne enfant suit le titre de l'enregistrement maître (mise à jour en cas de renommage)
- [ ] #6 Backfill utilisable via la CLI ou un endpoint dédié
- [ ] #7 Tests unitaires + intégration couvrant création, backfill, renommage et suppression
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Schema : stocker le réglage de synchronisation sur la base satellite (base maître + champ relation) — config sur databases ou database_fields.
2. API : étendre la création d'un enregistrement maître pour créer les lignes enfants liées dans le même appel (transactionnel) ; endpoint de backfill (activer le réglage → créer les lignes manquantes) ; cascade suppression/restauration (corbeille).
3. UI : réglage 'Synchroniser avec [base] via la relation [champ]' dans les paramètres de la base satellite + bouton 'Créer les lignes manquantes'.
4. CLI : commande de backfill (ex. notara databases sync <dbId>).
5. Renommage : le titre de la ligne enfant suit le titre du maître (mise à jour au rename).
6. Tests : unitaires + intégration (création, backfill, rename, suppression/restauration, cas many-to-many non concerné).
<!-- SECTION:PLAN:END -->
