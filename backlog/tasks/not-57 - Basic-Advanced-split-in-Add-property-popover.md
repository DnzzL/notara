---
id: NOT-57
title: Basic/Advanced split in Add-property popover
status: ready-for-agent
assignee: []
created_date: '2026-07-19 19:40'
labels:
  - enhancement
dependencies: []
priority: medium
ordinal: 60000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
AddFieldPopover lists all 10 field types in a single flat list (packages/app/src/components/db/FieldComponents.tsx:398-480), putting relation/people/formula at the same level as text, which walls off newcomers. Split into Basic (text, number, select, date, checkbox) shown by default and Advanced (multi-select, relation, page, people, formula) behind a fold/section. Keeps the powerful column types available as a reward, not a barrier (#4).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Add-property popover shows Basic types (text, number, select, date, checkbox) by default
- [ ] #2 Advanced types (multi-select, relation, page, people, formula) are grouped behind a fold or clearly separated section
- [ ] #3 All 10 field types remain creatable; per-type config (select options, relation target, formula) is unchanged
<!-- AC:END -->
