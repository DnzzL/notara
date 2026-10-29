---
id: NOT-105
title: 'CONTEXT.md: the domain glossary'
status: done
assignee:
  - '@thomas'
created_date: '2026-08-26 11:10'
updated_date: '2026-08-26 14:04'
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
- [x] #1 CONTEXT.md exists at the repo root and defines every domain term the codebase uses in names
- [x] #2 Each definition matches current behaviour, and terms carrying more than one meaning are flagged as such
- [x] #3 Terms whose shape was set by an ADR link to it
- [x] #4 It does not restate the architectural map already in CLAUDE.md
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Written from the code, then every ambiguity claim verified against it rather than from memory. One claim was wrong on first draft and corrected: workspaces.owner_id is not only consulted when refusing to remove the creator — the demo purge also uses it to find whose account to delete with an expired workspace. The corrected entry says what it is the source of truth for, and warns that authorization reads the role rather than the column, because the two can disagree.

The nine collisions flagged are the ones a newcomer actually trips on:
- owner: workspace role, ACL relation, and workspaces.owner_id
- member: workspace role, and the userset in workspace:<id>#member
- database: the entity, the block type embedding one, and the SQLite file per workspace
- relation: the ACL relation, and the field type pointing at another database
- page: the document, and the field type labelled 'Page link' in the picker
- ordering: blocks use index, everything else uses sortOrder

Locked page is given the most space because it is the load-bearing term: it is what makes the ACL model depart from Zanzibar, and reading ADR-007 without it does not land.

Deliberately not included: the architectural map, which is already in CLAUDE.md §6. This file is a dictionary.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Add CONTEXT.md, the domain glossary.

The repo had no glossary, so an outside contributor arriving at launch had no map of the vocabulary the code speaks — and no warning about the terms that carry more than one meaning. docs/agents/domain.md describes a single-context layout with CONTEXT.md created lazily; a public launch is when lazy expires.

Defines the vocabulary in five groups — container, content, databases, access, elsewhere — as the code actually uses it. Nine terms are flagged as carrying two or three meanings rather than being smoothed over, because those collisions are precisely what a newcomer trips on: owner (three senses), member, database (three senses), relation, the page field type, and index versus sortOrder for the same ordering concept.

Locked page gets the most space: it is the term ADR-007 turns on, and the ACL model does not make sense without it.

Every ambiguity claim was checked against the source. One was wrong on the first pass and is corrected in the file — see the notes.

Cross-references ADR-006, ADR-007 and ADR-008 where a term's shape was decided there. Does not restate the architectural map already in CLAUDE.md.
<!-- SECTION:FINAL_SUMMARY:END -->
