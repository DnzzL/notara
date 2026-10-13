---
id: NOT-149
title: Commentaires sur les pages
status: done
assignee:
  - '@claude'
created_date: '2026-10-13 12:53'
updated_date: '2026-10-13 13:33'
labels:
  - enhancement
dependencies: []
references:
  - specs/shared-backlog.md
  - docs/adr/012-notara-is-a-queue-backend.md
priority: medium
ordinal: 144000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Un fil de commentaires plat, en markdown, sur toute page (records ouverts en page inclus). Sert l'échange humain-agent et les notes.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Un membre ayant accès à la page lit et ajoute des commentaires depuis un panneau sur la page
- [x] #2 Seul l'auteur modifie ou supprime son commentaire
- [x] #3 Lire les commentaires suit l'accès à la page (ACL existante)
- [x] #4 Supprimer définitivement une page supprime ses commentaires (FK pragma OFF)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- Table comments (022), handler comments.ts, 4 RPC (list/add viewer+, update/delete auteur seul), CommentsPanel sous les backlinks.
- purgePage supprime les commentaires ; l'élagage de l'import Notion garde une page commentée.
- Corps stocké tel quel, borné à 10 000 caractères côté handler et RPC.
- Rendu en texte brut (pre-wrap), pas encore en markdown.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Fil de commentaires plat sur toute page (records ouverts en page inclus).
- Migration 022 (comments), handler comments.ts, RPC listComments/addComment (viewer+), updateComment/deleteComment (auteur seul, 403 sinon).
- Hard-delete : purgePage supprime les commentaires ; l'import Notion n'élague plus une page commentée.
- UI : CommentsPanel (auteur via getWorkspaceMembers, édition/suppression des siens, Cmd/Ctrl+Entrée).
Tests : test/comments.test.ts (8) ; suites complètes vertes. Non testé : permissions via la seam RPC, rendu navigateur.
<!-- SECTION:FINAL_SUMMARY:END -->
