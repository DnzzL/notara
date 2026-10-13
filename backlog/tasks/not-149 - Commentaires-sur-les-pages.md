---
id: NOT-149
title: Commentaires sur les pages
status: ready-for-agent
assignee: []
created_date: '2026-10-13 12:53'
labels:
  - enhancement
dependencies: []
references:
  - specs/shared-backlog.md
  - docs/adr/012-notara-is-a-queue-backend.md
priority: medium
ordinal: 144000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Un fil de commentaires plat, en markdown, sur toute page (records ouverts en page inclus). Sert l'échange humain-agent et les notes.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Un membre ayant accès à la page lit et ajoute des commentaires depuis un panneau sur la page
- [ ] #2 Seul l'auteur modifie ou supprime son commentaire
- [ ] #3 Lire les commentaires suit l'accès à la page (ACL existante)
- [ ] #4 Supprimer définitivement une page supprime ses commentaires (FK pragma OFF)
<!-- AC:END -->
