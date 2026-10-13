---
id: NOT-153
title: Filtre REST des records par valeur de champ
status: done
assignee:
  - '@claude'
created_date: '2026-10-13 12:53'
updated_date: '2026-10-13 13:48'
labels:
  - enhancement
dependencies: []
references:
  - specs/shared-backlog.md
priority: medium
ordinal: 148000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Un runner liste seulement les cartes d'un statut ou d'un agent donné, sans tout télécharger.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 La liste des records accepte un ou plusieurs couples champ=valeur, combinés en ET
- [x] #2 Un champ inconnu renvoie une erreur 400 explicite
- [x] #3 Le filtre figure dans le document OpenAPI
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- Databases.listRecordsMatching : champ par id puis nom, cellules lues par id de champ (deux champs peuvent partager un nom), comparaison sur valeur décodée (liste = appartenance, nombre numérique, checkbox absente = false, valeur vide = champ vide).
- REST : ?field=&value= répétables (helper queryParams), 400 sur paires incomplètes ou champ inconnu.
- Limite : un champ formula est comparé sur sa valeur stockée.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
La liste REST des records accepte des filtres champ=valeur combinés en ET.
- ?field=<id|nom>&value=<v> répétable ; 400 si champ inconnu (nommé) ou paires incomplètes.
- Comparaison sur la valeur décodée : appartenance pour multiSelect/people/relation/page, numérique pour number, checkbox jamais cochée = false, valeur vide = champ vide.
- Filtrage en mémoire après lecture des records (mono-instance).
Tests : record-filter.test.ts (8) via le harnais REST ; suites complètes vertes.
<!-- SECTION:FINAL_SUMMARY:END -->
