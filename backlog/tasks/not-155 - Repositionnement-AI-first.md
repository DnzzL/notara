---
id: NOT-155
title: Repositionnement AI-first
status: done
assignee:
  - '@claude'
created_date: '2026-10-13 12:53'
updated_date: '2026-10-13 14:36'
labels:
  - enhancement
dependencies:
  - NOT-150
  - NOT-153
  - NOT-154
references:
  - specs/shared-backlog.md
priority: low
ordinal: 150000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Tagline : The AI-first Notion alternative: notes, docs and one backlog your team and your agents share.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 README et landing portent la nouvelle tagline
- [x] #2 Une doc Shared backlog for humans and agents explique comment un outil externe lit, commente et clôt des cartes via l'API, sans nommer de runner
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Notara se présente comme « The AI-first Notion alternative: notes, docs and one backlog your team and your agents share. »
- README (tagline + paragraphe backlog partagé), landing (titre + accroche), métadonnées og/twitter (qui disaient encore « Fair-source »).
- docs/shared-backlog.md : le modèle (carte = record, id court, AC = to-dos, fil de commentaires, boîte) et les appels REST qu'un outil d'agents utilise, sans nommer de runner ; import Backlog.md.
- specs/shared-backlog.md : section Known gaps.
<!-- SECTION:FINAL_SUMMARY:END -->
