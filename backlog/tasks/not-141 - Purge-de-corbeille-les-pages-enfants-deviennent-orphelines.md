---
id: NOT-141
title: 'Purge de corbeille : les pages enfants deviennent orphelines'
status: done
assignee:
  - '@claude'
created_date: '2026-08-30 19:19'
updated_date: '2026-08-30 19:29'
labels:
  - bug
dependencies: []
priority: high
ordinal: 136000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
deletePage ne marque que la page ; ses enfants gardent is_deleted=0. La sidebar construit l'arbre depuis parent_id, donc les enfants disparaissent de l'UI avec le parent (attendu). Mais purgePage (trash-sweeper, 30j) supprime la ligne parent sans toucher aux pages enfants — et le pragma FK est OFF, donc le ON DELETE SET NULL ne se declenche pas. Resultat : des pages avec un parent_id pointant dans le vide, invisibles pour toujours dans la sidebar, contenu intact mais inatteignable hors recherche. Le commentaire de trash-sweeper.ts affirme a tort que les hard deletes cascadent via FK.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Choisir la semantique : purger le sous-arbre, ou remonter les enfants au grand-parent, ou soft-deleter le sous-arbre des la mise en corbeille
- [x] #2 Implementer et couvrir par un test serveur (page parent + enfant, purge, verifier l'etat de l'enfant)
- [x] #3 Corriger le commentaire de trash-sweeper.ts sur le cascade FK
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Option (c) retenue : soft-delete du sous-arbre des la mise en corbeille, colonne pages.trashed_with (migration 020).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Trashing a page now takes its subtree with it.

Why: deletePage marked one row while the sidebar builds its tree from parent_id, so descendants vanished from the UI without being in the trash. Once the retention sweep purged the parent row, they were left pointing at a parent that no longer existed — invisible for good, blocks intact, reachable only through search. The FK pragma is off, so ON DELETE SET NULL never fired.

Changes:
- Migration 020: pages.trashed_with (id of the page whose deletion swept this one up; NULL = deleted in its own right) + index.
- deletePage: marks the live subtree, stamping each descendant with the deleted page's id.
- restorePage: restores the page plus everything carrying its id, so a page trashed deliberately beforehand keeps its place in the trash.
- listTrash: lists only trashed_with IS NULL — one delete, one entry.
- purgePage: recurses into child pages before deleting the parent row.
- trash-sweeper comment corrected: nothing cascades via FK here.

Tests: packages/server/test/trash-subtree.test.ts (4 cases: subtree trashed and listed once, restore brings it back, an independently trashed child stays trashed, purge leaves no orphan). Red before, green after. Full suite 267 pass; e2e 101 pass.
<!-- SECTION:FINAL_SUMMARY:END -->
