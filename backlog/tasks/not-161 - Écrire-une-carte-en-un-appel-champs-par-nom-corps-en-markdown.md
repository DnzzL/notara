---
id: NOT-161
title: 'Écrire une carte en un appel : champs par nom, corps en markdown'
status: ready-for-agent
assignee: []
created_date: '2026-10-13 16:02'
labels:
  - enhancement
dependencies: []
references:
  - specs/shared-backlog.md
  - docs/shared-backlog.md
priority: medium
ordinal: 156000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Créer ou mettre à jour une carte demande un appel par champ et l'id de chaque champ, et le corps s'écrit en HTML d'éditeur. Un agent pense en noms de champs et en markdown.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Créer une carte accepte titre, valeurs de champs par nom ou id, corps markdown et critères, en un appel
- [ ] #2 Mettre à jour une carte accepte plusieurs valeurs de champs par nom ou id en un appel
- [ ] #3 Un champ inconnu ou une valeur invalide est refusé avec un message qui les nomme, sans rien écrire
- [ ] #4 Les opérations figurent dans le document OpenAPI
<!-- AC:END -->
