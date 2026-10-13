---
id: NOT-164
title: 'llms.txt : le cycle d''une carte pour les agents'
status: done
assignee:
  - '@claude'
created_date: '2026-10-13 16:02'
updated_date: '2026-10-13 19:16'
labels:
  - enhancement
dependencies:
  - NOT-159
  - NOT-160
  - NOT-161
references:
  - docs/shared-backlog.md
  - docs/adr/013-artifacts-run-isolated.md
priority: medium
ordinal: 159000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Un agent qui découvre une instance Notara trouve en une lecture comment travailler une carte, sans parcourir toute l'OpenAPI.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 GET /llms.txt décrit le cycle d'une carte (lister, lire, commenter, cocher, clore, créer) en appels concrets
- [x] #2 Il renvoie à /api/v1/openapi.json et à la doc du backlog partagé
- [x] #3 Il énonce la règle des artefacts : tout en inline, pas de réseau
- [x] #4 Il ne nomme aucun runner
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
GET /llms.txt (text/markdown) : cycle d'une carte en 6 appels, renvois OpenAPI, /api/docs et doc du backlog partagé, règle des artefacts, aucun runner nommé. Test : chaque appel cité correspond à une route de la table (garde-fou contre la dérive).
<!-- SECTION:FINAL_SUMMARY:END -->
