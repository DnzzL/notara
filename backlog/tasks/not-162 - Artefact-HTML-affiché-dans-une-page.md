---
id: NOT-162
title: Artefact HTML affiché dans une page
status: done
assignee:
  - '@claude'
created_date: '2026-10-13 16:02'
updated_date: '2026-10-13 20:05'
labels:
  - enhancement
dependencies: []
references:
  - docs/adr/013-artifacts-run-isolated.md
  - CONTEXT.md
priority: medium
ordinal: 157000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Un rapport, un dashboard ou un diff HTML autonome (ex. la sortie d'archify) s'affiche vivant dans la page qui le porte, isolé selon l'ADR-013. Suppose le correctif de service des attachments (branche fix/attachment-serving) fusionné.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Un humain ajoute un fichier HTML comme artefact à une page (upload ou glisser-déposer) ; il s'affiche dans la page
- [x] #2 L'artefact exécute ses scripts inline mais n'accède ni au réseau, ni à la page autour, ni à la session ; ouvert directement, pareil
- [x] #3 Les liens de l'artefact s'ouvrent dans un nouvel onglet
- [x] #4 Le cadre a une hauteur par défaut, se redimensionne, s'ouvre en plein écran et indique qu'il est isolé
- [x] #5 À l'ajout, les hôtes externes référencés par le HTML sont signalés, sans refuser l'ajout
- [x] #6 Ajouter à nouveau remplace l'artefact, sans historique ; un HTML déjà uploadé comme simple fichier reste un téléchargement
- [x] #7 Dans l'export markdown et le corps d'une carte, l'artefact devient un lien [Artifact: nom](url)
- [x] #8 Un artefact de plus de 5 Mo est refusé
- [x] #9 La sortie d'archify (.archify/*/coupdemain.html) s'affiche et fonctionne
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Un .html uploadé devient un artefact : bloc artifact, iframe sandbox (allow-scripts allow-popups, jamais allow-same-origin), servi en text/html avec CSP sandbox + default-src 'none', no-store, <base target=_blank> injecté. Hôtes externes signalés (toast + bloc), remplacement sur place par nom de fichier, refus > 5 Mo, export [Artifact: nom](url). Migration 027 attachments.artifact : les HTML existants restent des téléchargements. Vérifié en navigateur : archify fonctionne ; sonde : parent, cookie, storage, API, réseau bloqués. Tests : artifacts.test.ts (7).
<!-- SECTION:FINAL_SUMMARY:END -->
