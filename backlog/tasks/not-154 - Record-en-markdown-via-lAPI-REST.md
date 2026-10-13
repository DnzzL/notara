---
id: NOT-154
title: Record en markdown via l'API REST
status: done
assignee:
  - '@claude'
created_date: '2026-10-13 12:53'
updated_date: '2026-10-13 13:57'
labels:
  - enhancement
dependencies:
  - NOT-148
references:
  - specs/shared-backlog.md
priority: medium
ordinal: 149000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Un runner obtient une carte complète en un appel : titre, valeurs de champs, corps markdown et critères d'acceptation (blocs todo).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 La réponse liste les critères [{text, checked}] tirés des blocs todo de la page du record
- [x] #2 Fonctionne avec l'id ou l'id court
- [x] #3 Le format figure dans le document OpenAPI
- [x] #4 GET d'un record renvoie titre, valeurs de champs lisibles et corps de sa page en markdown
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- GET /databases/:dbId/records/:recordId (id ou id court) : record + fields + body markdown + criteria ; 404 si le record est d'une autre database ou à la corbeille.
- export/html-markdown.ts : HTML de l'éditeur → markdown via un arbre de balises (listes et to-dos imbriqués, toggles, callouts, code, entités décodées une fois). blockToMarkdown l'utilise : les exports markdown existants sortent désormais en markdown au lieu de HTML brut.
- Pas de paramètre format : aucun GET d'un record n'existait ; AC1 et le spec reformulés.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Un runner obtient une carte complète en un appel REST.
- GET /api/v1/workspaces/:ws/databases/:dbId/records/:recordId (id ou NOT-12) → record, fields, body (page du record en markdown), criteria [{text, checked}] (to-dos de la page, imbriqués inclus).
- Nouveau convertisseur HTML→markdown (export/html-markdown.ts), aussi utilisé par l'export markdown des pages, qui sortait jusqu'ici du HTML brut.
Tests : record-markdown.test.ts (8) via le harnais REST ; suites complètes vertes.
<!-- SECTION:FINAL_SUMMARY:END -->
