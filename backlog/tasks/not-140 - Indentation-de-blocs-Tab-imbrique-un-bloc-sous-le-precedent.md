---
id: NOT-140
title: Indentation de blocs (Tab imbrique un bloc sous le precedent)
status: ready-for-human
assignee: []
created_date: 2026-08-30 18:49
updated_date: '2026-11-10T17:05:00Z'
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
- [ ] #1 Decider si le nesting de blocs entre au perimetre
- [ ] #2 Si oui : rendu hierarchique, Tab/Shift-Tab reparentent, drag-and-drop et numerotation suivent
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Triage: AC #1 is a product decision (does block nesting enter scope?) - needs a human call before an agent builds the tree rendering.
<!-- SECTION:NOTES:END -->
