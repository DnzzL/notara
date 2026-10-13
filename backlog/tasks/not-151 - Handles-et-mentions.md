---
id: NOT-151
title: Handles et @mentions
status: ready-for-agent
assignee: []
created_date: '2026-10-13 12:53'
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
- [ ] #1 Un membre reçoit un handle dérivé de son nom en rejoignant le workspace, unique dans le workspace, modifiable
- [ ] #2 Taper @ dans un commentaire propose les handles des membres
- [ ] #3 Un @handle valide dans un commentaire (UI ou REST) est enregistré comme mention ; un handle inconnu reste du texte
- [ ] #4 Aucun handle ni texte de commentaire n'est envoyé à PostHog
<!-- AC:END -->
