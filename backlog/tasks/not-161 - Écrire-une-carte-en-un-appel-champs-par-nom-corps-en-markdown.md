---
id: NOT-161
title: 'Écrire une carte en un appel : champs par nom, corps en markdown'
status: done
assignee:
  - '@claude'
created_date: '2026-10-13 16:02'
updated_date: '2026-10-13 19:12'
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
- [x] #1 Créer une carte accepte titre, valeurs de champs par nom ou id, corps markdown et critères, en un appel
- [x] #2 Mettre à jour une carte accepte plusieurs valeurs de champs par nom ou id en un appel
- [x] #3 Un champ inconnu ou une valeur invalide est refusé avec un message qui les nomme, sans rien écrire
- [x] #4 Les opérations figurent dans le document OpenAPI
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
POST records accepte title, fields (nom ou id), body markdown, criteria ; PATCH record accepte fields. Toutes les valeurs vérifiées avant écriture (select/multiSelect contre les options, nombre, booléen, date, formule refusée) → 422 qui nomme le champ, rien d'écrit (transaction). Les deux renvoient le document complet. Markdown : gras, italique, code, liens http(s) rendus en marques d'éditeur ; au passage, to-dos cochés du corps et premier # conservés (bug du parseur partagé, import Backlog.md inclus). Tests : record-write.test.ts (12).
<!-- SECTION:FINAL_SUMMARY:END -->
