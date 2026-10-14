---
id: NOT-158
title: La page d'un record montre son record
status: ready-for-agent
assignee:
  - '@claude'
created_date: '2026-10-13 13:23'
updated_date: '2026-10-14 07:43'
labels:
  - enhancement
dependencies: []
priority: low
ordinal: 153000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Un record ouvert en page (DatabaseRecord.pageId) n'affiche ni son id court ni ses champs : la page ignore qu'elle est un record. Constaté pendant NOT-148.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 La page pleine d'un record affiche son id court
- [ ] #2 La page pleine d'un record affiche ses valeurs de champs
<!-- AC:END -->
