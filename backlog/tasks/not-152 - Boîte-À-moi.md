---
id: NOT-152
title: Boîte À moi
status: ready-for-agent
assignee: []
created_date: '2026-10-13 12:53'
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
- [ ] #1 Une mention crée une entrée dans la boîte du membre mentionné
- [ ] #2 Un commentaire sur un record où le membre figure dans un champ people crée une entrée (sauf pour l'auteur)
- [ ] #3 Le badge non-lu se met à jour en direct via le SSE existant
- [ ] #4 Ouvrir une entrée mène à la page et la marque lue ; tout marquer lu est possible
- [ ] #5 Supprimer définitivement une page supprime ses entrées de boîte
<!-- AC:END -->
