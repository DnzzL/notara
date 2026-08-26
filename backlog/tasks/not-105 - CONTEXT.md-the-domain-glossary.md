---
id: NOT-105
title: 'CONTEXT.md: the domain glossary'
status: ready-for-agent
assignee: []
created_date: '2026-08-26 11:10'
labels:
  - enhancement
dependencies: []
priority: medium
ordinal: 100000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The repo has no domain glossary. An outside contributor arriving at launch has no map of the vocabulary the code speaks: workspace, page, block, database, field, record, view, saved view, view reference, relation, subject, userset, workspace member role, attachment, template, presence, backup.

The agent-facing domain convention describes a single-context setup — CONTEXT.md at the root, lazily created, alongside the ADR log. A public launch is when lazy expires.

Define each term as the code actually uses it, not as it would ideally be defined. Where a term is currently ambiguous or carries two meanings, say so rather than smoothing it over — that ambiguity is exactly what a contributor trips on. Cross-reference the ADR log where a term's shape was decided there.

Keep it a glossary, not an architecture document. The architectural map already lives in CLAUDE.md and should not be duplicated.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 CONTEXT.md exists at the repo root and defines every domain term the codebase uses in names
- [ ] #2 Each definition matches current behaviour, and terms carrying more than one meaning are flagged as such
- [ ] #3 Terms whose shape was set by an ADR link to it
- [ ] #4 It does not restate the architectural map already in CLAUDE.md
<!-- AC:END -->
