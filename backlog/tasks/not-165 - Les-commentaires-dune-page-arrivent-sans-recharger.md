---
id: NOT-165
title: Les commentaires d'une page arrivent sans recharger
status: done
assignee:
  - '@claude'
created_date: '2026-10-13 18:12'
updated_date: '2026-10-14 07:59'
labels:
  - bug
dependencies: []
priority: medium
ordinal: 160000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Un commentaire posté par un agent (REST) n'apparaît dans la page ouverte qu'après rechargement ; seul le badge inbox est poussé. Constaté au passage navigateur.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Un commentaire créé, modifié ou supprimé ailleurs apparaît dans la page ouverte sans recharger
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Le flux SSE de la page pousse comments.changed à chaque ajout, édition ou suppression (émis dans comments.ts, passage commun RPC et REST), auteur compris ; le fil se recharge. Vérifié en navigateur : un commentaire posté par clé apparaît sans recharger. Test : comments.test.ts.
<!-- SECTION:FINAL_SUMMARY:END -->
