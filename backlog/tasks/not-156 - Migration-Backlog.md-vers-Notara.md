---
id: NOT-156
title: Migration Backlog.md vers Notara
status: ready-for-agent
assignee: []
created_date: '2026-10-13 12:53'
labels:
  - enhancement
dependencies:
  - NOT-148
  - NOT-150
references:
  - specs/shared-backlog.md
priority: medium
ordinal: 151000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Import one-shot du backlog de Notara (tasks, completed, archive) dans une database Notara, via l'API, selon la table de migration du spec.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Chaque tâche devient un record dont l'id court garde le numéro NOT-xxx
- [ ] #2 Statut, assignee, labels, priorité, AC, sections et commentaires sont repris selon le spec
- [ ] #3 Les tâches completed et archive arrivent en done
- [ ] #4 Rejouer le script ne crée aucun doublon (table id source vers cible)
<!-- AC:END -->
