---
id: NOT-162
title: Artefact HTML affiché dans une page
status: ready-for-agent
assignee: []
created_date: '2026-10-13 16:02'
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
- [ ] #1 Un humain ajoute un fichier HTML comme artefact à une page (upload ou glisser-déposer) ; il s'affiche dans la page
- [ ] #2 L'artefact exécute ses scripts inline mais n'accède ni au réseau, ni à la page autour, ni à la session ; ouvert directement, pareil
- [ ] #3 Les liens de l'artefact s'ouvrent dans un nouvel onglet
- [ ] #4 Le cadre a une hauteur par défaut, se redimensionne, s'ouvre en plein écran et indique qu'il est isolé
- [ ] #5 À l'ajout, les hôtes externes référencés par le HTML sont signalés, sans refuser l'ajout
- [ ] #6 Ajouter à nouveau remplace l'artefact, sans historique ; un HTML déjà uploadé comme simple fichier reste un téléchargement
- [ ] #7 Dans l'export markdown et le corps d'une carte, l'artefact devient un lien [Artifact: nom](url)
- [ ] #8 Un artefact de plus de 5 Mo est refusé
- [ ] #9 La sortie d'archify (.archify/*/coupdemain.html) s'affiche et fonctionne
<!-- AC:END -->
