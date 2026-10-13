---
id: NOT-152
title: Boîte À moi
status: done
assignee:
  - '@claude'
created_date: '2026-10-13 12:53'
updated_date: '2026-10-13 14:20'
labels:
  - enhancement
dependencies:
  - NOT-151
references:
  - specs/shared-backlog.md
priority: medium
ordinal: 147000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
L'humain traite une file au lieu de fouiller les boards : mentions et commentaires sur les records qui le concernent.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Une mention crée une entrée dans la boîte du membre mentionné
- [x] #2 Un commentaire sur un record où le membre figure dans un champ people crée une entrée (sauf pour l'auteur)
- [x] #3 Le badge non-lu se met à jour en direct via le SSE existant
- [x] #4 Ouvrir une entrée mène à la page et la marque lue ; tout marquer lu est possible
- [x] #5 Supprimer définitivement une page supprime ses entrées de boîte
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- inbox_entries (025), Inbox.notify depuis Comments (ajout/édition), forgetComment à la suppression ; SSE /api/stream/inbox (subscriberSet partagé dans sse-channel.ts) ; RPC listInbox/markInboxRead ; InboxButton dans la sidebar.
- Décision : un commentaire écrit via une clé API notifie aussi le propriétaire de la clé (c'est son agent qui parle) — sinon les questions du runner n'arrivent jamais à l'humain.
- Limites : mettre une page à la corbeille / la restaurer ne repousse pas le compteur (l'entrée est seulement masquée) ; complétion @ absente dans l'édition d'un commentaire.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Chaque membre a une boîte « À moi » par workspace, avec un badge non-lu en direct.
- Entrées : commentaires qui le mentionnent, ou sur un record dont un champ people l'assigne ; jamais si la page lui est invisible ; un commentaire via clé API atteint aussi le propriétaire de la clé.
- Badge poussé par SSE (/api/stream/inbox), compteur initial à l'ouverture, suit le changement de workspace.
- Ouvrir une entrée mène à la page et la marque lue ; « Mark all read ».
- Supprimer un commentaire ou purger une page retire ses entrées.
Tests : inbox.test.ts (10) ; suites complètes vertes.
<!-- SECTION:FINAL_SUMMARY:END -->
