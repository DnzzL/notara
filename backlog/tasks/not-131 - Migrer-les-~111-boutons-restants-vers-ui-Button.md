---
id: NOT-131
title: Migrer les ~111 boutons restants vers ui/Button
status: ready-for-agent
assignee:
  - '@claude'
created_date: '2026-08-28 09:03'
updated_date: '2026-08-28 09:22'
labels:
  - enhancement
dependencies: []
priority: medium
ordinal: 126000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Après l'introduction des primitives (Button, Input, Tabs, MenuItem, Badge), 111 éléments <button> bruts subsistent — surtout BlockEditor (17), DatabaseView (7), CalendarView (7), ViewSwitcher (7). Chacun réimplémente à la main une variante existante.

Le test packages/app/test/design-tokens.test.ts garde les couleurs et les rayons mais n'impose pas l'usage des primitives : c'est une question de revue, pas de machine. Ce ticket est le rattrapage manuel.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 BlockEditor, DatabaseView, CalendarView et ViewSwitcher n'utilisent plus de <button> brut pour une action qu'une variante existante couvre
- [ ] #2 bun run quickcheck et biome ci restent verts
<!-- AC:END -->
