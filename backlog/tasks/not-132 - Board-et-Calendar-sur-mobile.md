---
id: NOT-132
title: Board et Calendar sur mobile
status: done
assignee:
  - '@claude'
created_date: '2026-08-28 09:20'
updated_date: '2026-08-28 09:43'
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
- [x] #1 Board et Calendar ont un rendu adapté sous 880px, ou sont explicitement redirigés vers la vue Table avec un message
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Board et Calendar ont chacun un vrai rendu sous 880px, dans le langage déjà posé par le field ruler. L'AC autorisait une redirection vers la vue Table avec un message ; c'était admettre que la moitié des vues ne marche pas au pouce.

Board — on navigue le groupe, pas la colonne : bandeau de groupes avec compteurs, puis les cartes de ce groupe en pleine largeur. Cartes en lecture seule : glisser une carte entre colonnes est un geste pointeur sans équivalent honnête au pouce, et l'enregistrement est à un tap.

Calendar — un agenda. Une grille mensuelle à 390px donne des cases de 50px. Jours dans l'ordre, enregistrements sous leur jour, non datés en dernier, aujourd'hui marqué en accent. Le sélecteur de mois est masqué en mode agenda : l'agenda liste tout, un pas mensuel mentirait sur sa portée.

Le regroupement est une fonction pure dans lib/agenda.ts, écrite en test d'abord (7 tests).

Le bandeau devient partagé (db-strip-*) : table et board se naviguent pareil.

Piège rencontré : brancher au-dessus de la barre d'outils supprimait celle-ci, ce qui enfermait l'utilisateur dans une vue sans retour possible. Les deux branchent maintenant en dessous.
<!-- SECTION:FINAL_SUMMARY:END -->
