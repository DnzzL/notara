---
id: NOT-168
title: L'inbox dit quand un commentaire vient d'un agent
status: done
assignee:
  - '@claude'
created_date: '2026-10-13 18:12'
updated_date: '2026-10-14 07:44'
labels:
  - enhancement
dependencies: []
priority: low
ordinal: 163000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Une entrée d'inbox pour un commentaire écrit via une clé dit « Thomas Legrand mentioned you », sans le nom de la clé ; la page, elle, affiche « via docket ».
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Une entrée d'inbox d'un commentaire écrit via une clé affiche le nom de la clé
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Une entrée d'inbox porte keyName (clé du commentaire) ; l'app affiche « Ann via docket commented on … ». Test : inbox.test.ts.
<!-- SECTION:FINAL_SUMMARY:END -->
