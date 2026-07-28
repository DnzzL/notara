---
id: NOT-57
title: Basic/Advanced split in Add-property popover
status: ready-for-human
assignee:
  - '@thomas'
created_date: '2026-07-19 19:40'
updated_date: '2026-07-21 16:39'
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
- [x] #1 Add-property popover shows Basic types (text, number, select, date, checkbox) by default
- [x] #2 Advanced types (multi-select, relation, page, people, formula) are grouped behind a fold or clearly separated section
- [x] #3 All 10 field types remain creatable; per-type config (select options, relation target, formula) is unchanged
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Define basicTypes set (`new Set(['text','number','select','date','checkbox'])`) and split FIELD_TYPES into `basicTypes` and `advancedTypes` lists.
2. Render basic types immediately. Add a fold/section divider for advanced types with a clickable toggle to show/hide.
3. Use a `showAdvanced` state in AddFieldPopover to control the fold.
4. Per-type config (options for select/multiSelect, expression for formula, relation target) stays unchanged — it already renders conditionally based on the selected `type` state.
5. All 10 types remain selectable; selecting any type adjusts config UI accordingly.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Split the flat 10-type list in AddFieldPopover into Basic (text, number, select, date, checkbox) shown by default and Advanced (multi-select, page, relation, formula, people) behind a click-to-expand fold.

Changes:
- Added BASIC_TYPES Set near FIELD_TYPES definition
- Added showAdvanced state toggle
- Basic types render immediately; advanced types only when toggled
- Fold shows ▶ arrow with rotation animation and Show/Hide text
- Per-type config (select options, formula expression, relation target) is unchanged
- Only file changed: packages/app/src/components/db/FieldComponents.tsx

All 64 app tests pass.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Split AddFieldPopover's flat 10-type list into Basic (text, number, select, date, checkbox) shown by default and Advanced (multi-select, page, relation, formula, people) behind a click-to-expand fold.

Changes:
- Added BASIC_TYPES Set constant near FIELD_TYPES
- Added showAdvanced state toggle in AddFieldPopover
- Basic types render immediately; advanced types appear only when the fold is expanded
- Fold uses a triangle arrow with CSS rotation animation
- Per-type config (select options, formula expression, relation target) is unchanged
- Only file changed: FieldComponents.tsx

Tests: 64 app tests pass, tsc has no new errors.
<!-- SECTION:FINAL_SUMMARY:END -->
