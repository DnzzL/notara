---
id: NOT-166
title: La sidebar ne liste pas les pages des records
status: done
assignee:
  - '@claude'
created_date: '2026-10-13 18:12'
updated_date: '2026-10-14 07:59'
labels:
  - bug
dependencies: []
priority: medium
ordinal: 161000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Chaque record ouvert en page apparaît sous la page de sa base dans la sidebar : 163 cartes importées noient l'arbre. Constaté au passage navigateur.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Les pages des records n'apparaissent pas dans l'arbre de la sidebar
- [x] #2 Elles restent accessibles depuis la base et la recherche
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Une page sait quel record elle ouvre (Page.recordId, null sinon) ; la sidebar n'affiche plus les pages des records. Elles restent ouvertes depuis la base et trouvées par la recherche (vérifié en navigateur sur 163 cartes). Migration 028 : index sur database_records.page_id. Test : record-write.test.ts.
<!-- SECTION:FINAL_SUMMARY:END -->
