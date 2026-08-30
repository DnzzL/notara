---
id: NOT-139
title: Restaurer les 7 blocs perdus de la page Boissons
status: needs-info
assignee: []
created_date: '2026-08-30 18:49'
labels:
  - bug
dependencies: []
priority: high
ordinal: 134000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
La page Boissons (01KVGF4W1F7XC8RZ7CTK8YEYTP, workspace Let's get married) a perdu les blocs d'index 1 a 7 ; il reste l'index 0 et le 8. Cause identifiee : l'index de bloc etait fige au montage de l'editeur, donc Backspace/Entree agissaient sur un bloc voisin (corrige). Les blocs sont hard-deletes (pas de soft-delete sur la table blocks), la seule voie de recuperation est une archive de backup. /api/backup/list et /api/settings repondent 500 avec une cle API : cible de backup probablement non configuree.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Determiner si une archive anterieure a la perte existe (S3 ou volume /data)
- [ ] #2 Si oui : extraire les blocs de page_id=01KVGF4W1F7XC8RZ7CTK8YEYTP depuis le SQLite de l'archive et les reinserer via l'API, sans toucher au reste de l'instance
- [ ] #3 Si non : le documenter et fermer
<!-- AC:END -->
