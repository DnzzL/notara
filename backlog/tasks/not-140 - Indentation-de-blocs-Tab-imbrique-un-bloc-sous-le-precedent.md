---
id: NOT-140
title: Indentation de blocs (Tab imbrique un bloc sous le precedent)
status: ready-for-agent
assignee: []
created_date: 2026-08-30 18:49
updated_date: '2026-11-11T23:01:00Z'
labels:
  - enhancement
milestone: m-2
dependencies: []
priority: medium
ordinal: 135000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Tab indente aujourd'hui a l'interieur d'un bloc (liste multi-items) et, a defaut, ne fait rien. L'indentation facon Notion — imbriquer un bloc sous le precedent — demande d'utiliser blocks.parent_id (deja en base, toujours NULL cote app) et de rendre l'arbre au lieu de la liste plate. Decision produit avant implementation.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Slice 1: nesting via the existing blocks.parent_id column (the brief's 'parent_block_id'; do not add a second column), Tab/Shift-Tab nest/un-nest under the previous block, rendered hierarchically with indentation
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Triage: AC #1 is a product decision (does block nesting enter scope?) - needs a human call before an agent builds the tree rendering.

Slice 1 done on branch task/42: reuses blocks.parent_id (no migration), reparentBlock op (RPC/REST/CLI), Tab/Shift-Tab, indented rendering on page + public page. ADR-016. Follow-ups filed: drag/move subtree, numbering, undo subtree.
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: @assistant
created: 2026-11-11T21:57:00Z

---

Decision (approved): block nesting is in scope: Tab/Shift-Tab nest and un-nest a block under the previous one, rendered hierarchically. This is large (one TipTap editor per block) and must be sliced. Slice 1 = parent_block_id + Tab/Shift-Tab + indented rendering. Drag-and-drop and numbering come later, as separate tickets.

---
<!-- COMMENTS:END -->
