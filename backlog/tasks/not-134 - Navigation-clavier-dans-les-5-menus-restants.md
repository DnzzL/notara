---
id: NOT-134
title: Navigation clavier dans les 5 menus restants
status: ready-for-agent
assignee: []
created_date: '2026-08-28 10:39'
labels:
  - bug
dependencies: []
priority: medium
ordinal: 129000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
lib/useMenuKeyboard.ts existe et BlockContextMenu l'utilise. Cinq menus n'ont toujours aucune gestion du clavier — ouvrez-les et les flèches ne vont nulle part, le déclencheur garde le focus :

- PageMenu (boutons hétérogènes, il faut d'abord les rassembler en tableau d'items)
- EmojiPicker
- TemplatePicker
- db/ViewSwitcher
- db/FieldComponents (sélecteur de type de champ)

Tous copient le balisage de SlashMenu sans son comportement.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Les cinq menus répondent aux flèches, Home/End, Enter et Escape via useMenuKeyboard
- [ ] #2 Le curseur clavier et le survol restent synchronisés
<!-- AC:END -->
