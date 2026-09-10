---
id: NOT-134
title: Navigation clavier dans les 5 menus restants
status: done
assignee: []
created_date: '2026-08-28 10:39'
updated_date: '2026-09-01 18:21'
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
- [x] #1 Les cinq menus répondent aux flèches, Home/End, Enter et Escape via useMenuKeyboard
- [x] #2 Le curseur clavier et le survol restent synchronisés
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Wired the existing lib/useMenuKeyboard.ts hook (arrows, Home/End, Enter, Escape, cursor/hover sync) into the 5 remaining menus: PageMenu (buttons collected into an items array first), EmojiPicker (grid + categories flattened into one keyboard index), TemplatePicker, db/ViewSwitcher (nav disabled while a rename/save-as input has focus, to avoid index drift), and db/FieldComponents' field-type selector (ColumnHeader's CHANGE TYPE TO list). tsc (app+server) and biome clean; 267 server tests pass. Code-reviewed on two axes (standards + spec); the only flagged issue (ref forwarding through the non-forwardRef MenuItem component in ViewSwitcher) was verified as a non-issue under React 19's ref-as-prop semantics (confirmed empirically with a jsdom repro). Known minor trade-off: EmojiPicker's search input's own Home/End keys get captured by the menu-wide listener while typing a query — same combobox precedent as SlashMenu (Enter selects while filtering), left as-is rather than adding target-checking logic to the shared hook.
<!-- SECTION:FINAL_SUMMARY:END -->
