---
id: NOT-151
title: Handles et @mentions
status: done
assignee:
  - '@claude'
created_date: '2026-10-13 12:53'
updated_date: '2026-10-13 14:09'
labels:
  - enhancement
dependencies:
  - NOT-149
references:
  - specs/shared-backlog.md
priority: medium
ordinal: 146000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Chaque membre du workspace a un handle unique ; @handle dans un commentaire mentionne ce membre, sans exposer d'email.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Un membre reçoit un handle dérivé de son nom en rejoignant le workspace, unique dans le workspace, modifiable
- [x] #2 Taper @ dans un commentaire propose les handles des membres
- [x] #3 Un @handle valide dans un commentaire (UI ou REST) est enregistré comme mention ; un handle inconnu reste du texte
- [x] #4 Aucun handle ni texte de commentaire n'est envoyé à PostHog
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- Handle : workspace_members.handle (platform 006 + index unique 007), alloué par addMember (seul chemin d'insertion), backfill après migrations ; setMyHandle (409 si pris, 400 si malformé).
- Mentions : comment_mentions (024), résolues à l'ajout et à l'édition (RPC et REST) ; code ignoré ; @handle inconnu = texte.
- UI : complétion @ dans la zone de nouveau commentaire (pas dans l'édition) ; handle visible et modifiable dans les réglages.
- Pour NOT-152 : un membre retiré garde ses rows de mention ; un membre mentionné peut ne pas avoir accès à la page.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Chaque membre a un @handle unique dans le workspace ; @handle dans un commentaire mentionne ce membre.
- Handle dérivé du prénom à l'arrivée (thomas, thomas2…), modifiable dans les réglages ; backfill des membres existants au démarrage.
- Mentions résolues à l'ajout/édition, depuis l'app comme via REST ; code ignoré ; Comment.mentions = ids des membres.
- Complétion @ dans la zone de commentaire (clavier + listbox accessible).
- Aucune donnée envoyée à PostHog.
Tests : handles.test.ts (5), comments.test.ts (18) ; suites complètes vertes.
<!-- SECTION:FINAL_SUMMARY:END -->
