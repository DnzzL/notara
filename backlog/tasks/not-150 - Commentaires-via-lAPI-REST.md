---
id: NOT-150
title: Commentaires via l'API REST
status: done
assignee:
  - '@claude'
created_date: '2026-10-13 12:53'
updated_date: '2026-10-13 13:42'
labels:
  - enhancement
dependencies:
  - NOT-149
references:
  - specs/shared-backlog.md
priority: medium
ordinal: 145000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Un runner lit et écrit les commentaires d'une page avec une clé API.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 GET liste les commentaires d'une page, du plus ancien au plus récent
- [x] #2 POST ajoute un commentaire ; la réponse porte l'auteur (utilisateur de la clé) et le nom de la clé
- [x] #3 Une clé en lecture seule ne peut pas commenter
- [x] #4 Les opérations figurent dans le document OpenAPI
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- Migration 023 key_name (instantané du nom de clé). ApiUser.keyName → OperationContext.keyName.
- GET/POST /pages/:pageId/comments (viewer+), tag OpenAPI Comments.
- Harnais REST test/rest-harness.ts : exécute le handler de route réel (auth clé, scope, membre, permission) via respond(operationHandler(op)) ; handle = respond + bases de prod.
- UI : « via <clé> » sur les commentaires.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Les commentaires sont lisibles et écrivables via REST avec une clé API.
- GET/POST /api/v1/workspaces/:ws/pages/:pageId/comments ; auteur = utilisateur de la clé, keyName = nom de la clé (null depuis l'app).
- Une clé read est refusée (403) par le contrôle de scope existant ; un non-membre aussi.
- Harnais de test REST qui passe par les vraies routes (auth, scope, membre, permission).
Tests : comments.test.ts (13) ; suites complètes vertes.
<!-- SECTION:FINAL_SUMMARY:END -->
