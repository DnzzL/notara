---
id: NOT-167
title: Le corps d'un commentaire s'affiche en markdown
status: done
assignee:
  - '@claude'
created_date: '2026-10-13 18:12'
updated_date: '2026-10-14 07:46'
labels:
  - enhancement
dependencies: []
priority: low
ordinal: 162000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
CONTEXT.md définit un commentaire comme une note markdown, mais l'app affiche le texte brut (backticks, astérisques visibles).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Gras, italique, code et liens d'un commentaire s'affichent mis en forme
- [x] #2 Aucun HTML du commentaire n'est interprété
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Le corps d'un commentaire s'affiche en markdown : gras, italique, code, liens http(s) (nouvel onglet), blocs ``` en code. Même règle inline que le corps d'une carte, déplacée dans @notara/shared (inlineMarkdown). Tout HTML du commentaire est échappé. Test : packages/app/test/comment-markdown.test.ts.
<!-- SECTION:FINAL_SUMMARY:END -->
