---
id: NOT-157
title: 'Bascule : retirer Backlog.md'
status: ready-for-human
assignee: []
created_date: '2026-10-13 12:53'
updated_date: '2026-10-14 20:45'
labels:
  - enhancement
dependencies:
  - NOT-156
references:
  - specs/shared-backlog.md
priority: medium
ordinal: 152000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Décision de bascule une fois l'import vérifié et l'adapter du runner disponible (hors repo).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 CLAUDE.md, docs/agents/issue-tracker.md et docs/agents/triage-labels.md décrivent le backlog Notara via la CLI du runner
- [ ] #2 Le dossier backlog/ n'est plus la source de vérité
<!-- AC:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: @agent
created: 2026-10-14 20:31
---
L'import REST est en place (shortNumber sur POST /records + packages/server/src/import-backlog-api.ts). Il exige que l'instance cible ait ce build : pas encore deploye sur notara.legrand.sh. Prochaine etape : deployer, puis lancer l'import avec la cle ntr_ du workspace 01M4Y0QYYMHJR80336739NTZ72.
---

author: @agent
created: 2026-10-14 20:45
---
Import exécuté le 2026-10-14 via packages/server/src/import-backlog-api.ts : 173 cartes dans la base 01M4Y2HFPHQ7NZY6ZVT7YE6RAD (workspace 01M4Y0QYYMHJR80336739NTZ72). Vérifié : 173/173, 0 écart sur titre/status/priorité/agent/labels, sous-tâches NOT-25.1..5 conservées (NOT-169..173, provenance en tête de corps), 37 commentaires conformes, 24 dépendances toutes résolues. Restent les étapes 4-6 : config runner kind=notara, docs agents, retrait de backlog/ comme source de vérité.
---
<!-- COMMENTS:END -->
