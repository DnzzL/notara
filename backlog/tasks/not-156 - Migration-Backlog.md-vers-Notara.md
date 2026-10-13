---
id: NOT-156
title: Migration Backlog.md vers Notara
status: done
assignee:
  - '@claude'
created_date: '2026-10-13 12:53'
updated_date: '2026-10-13 14:34'
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
- [x] #1 Chaque tâche devient un record dont l'id court garde le numéro NOT-xxx
- [x] #2 Statut, assignee, labels, priorité, AC, sections et commentaires sont repris selon le spec
- [x] #3 Les tâches completed et archive arrivent en done
- [x] #4 Rejouer le script ne crée aucun doublon (table id source vers cible)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- Import côté serveur (src/import/backlog.ts + CLI src/import-backlog.ts), pas via REST : seul l'import peut fixer un numéro (Databases.setShortNumber). Écart à la description « via l'API » — à valider.
- Une transaction pour tout le run ; ledger (source backlog.md) pour rejouer sans doublon ; ids en double refusés ; fichiers illisibles signalés ; code de sortie 1 en échec.
- Frontmatter/config via Bun.YAML ; sections lues par marqueurs SECTION:X ; corps en HTML d'éditeur échappé ; sous-tâches NOT-25.x → numéro suivant libre, id d'origine dans le corps ; champ « Depends on » (relation) en plus du spec.
- Essai à blanc sur backlog/ : 163/163, relance 0 importée / 163 sautées.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Le backlog Backlog.md de Notara s'importe dans une database Notara en une commande.
- bun packages/server/src/import-backlog.ts <workspaceId> <userId> [backlog]
- Chaque tâche garde son numéro NOT-n ; statut, agent, labels, priorité, dépendances en champs ; AC en to-dos ; description, plan, notes, résumé en corps ; commentaires avec auteur d'origine ; completed/archive → done.
- Rejouable sans doublon ; un run qui échoue ne laisse rien.
Tests : backlog-import.test.ts (10) ; essai réel 163/163 ; suites complètes vertes.
<!-- SECTION:FINAL_SUMMARY:END -->
