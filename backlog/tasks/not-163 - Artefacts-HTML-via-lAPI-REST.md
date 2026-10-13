---
id: NOT-163
title: Artefacts HTML via l'API REST
status: done
assignee:
  - '@claude'
created_date: '2026-10-13 16:02'
updated_date: '2026-10-13 20:14'
labels:
  - enhancement
dependencies:
  - NOT-162
references:
  - docs/adr/013-artifacts-run-isolated.md
priority: medium
ordinal: 158000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Un agent joint son rapport HTML à une carte en un appel, et le régénère au même endroit.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 POST /pages/:pageId/artifacts ajoute un artefact (corps = le HTML, nom en paramètre) en fin de page et renvoie son id
- [x] #2 PUT /artifacts/:id remplace le contenu
- [x] #3 La réponse liste les hôtes externes qui ne se chargeront pas (blockedHosts)
- [x] #4 Plus de 5 Mo, ou une clé read, est refusé ; l'accès suit celui de la page
- [x] #5 Les opérations figurent dans le document OpenAPI
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
POST /pages/:pageId/artifacts?name=…, POST /databases/:dbId/records/:recordId/artifacts?name=… (ouvre la page de la carte), PUT /artifacts/:id ; corps = HTML brut ; réponse {id, url, blockedHosts}. Même nom → remplacé. Editor sur la page, clé read refusée, > 5 Mo et nom non .html → 422. OpenAPI : tag Artifacts, schéma Artifact. llms.txt et doc du backlog partagé à jour. Tests : artifacts.test.ts (4 REST).
<!-- SECTION:FINAL_SUMMARY:END -->
