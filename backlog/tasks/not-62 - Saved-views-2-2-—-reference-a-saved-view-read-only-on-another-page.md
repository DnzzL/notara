---
id: NOT-62
title: Saved views 2/2 — reference a saved view read-only on another page
status: ready-for-agent
assignee: []
created_date: '2026-07-20 10:05'
labels:
  - enhancement
dependencies: []
priority: medium
ordinal: 65000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A new block references an existing database view BY ID and renders it read-only on any page. The view definition stays centralized on the database (config never copied onto the consuming page); editing the source view propagates to every reference. This is the anti-Notion-mess design: references are read-only mirrors — a different slice means creating another named view ON the database and referencing that. SECURITY: access must resolve to the source view's owning page via the existing getViewPageId/checkViewPermission path; a reference must never grant access. Includes a prefactor giving the table/board/calendar view components a read-only rendering mode. Independent of Saved views 1/2 but recommended after it.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A slash command inserts a view-reference block; a picker chooses a source database and one of its saved views
- [ ] #2 The block renders the chosen view (table/board/calendar) read-only — no record creation, deletion, or inline cell edits
- [ ] #3 Editing the source view's config updates what the reference displays (single source of truth; config not copied onto the consuming page)
- [ ] #4 If the viewer lacks access to the source view's owning page, the block renders a locked/empty state and no record data is fetched (uses getViewPageId/checkViewPermission)
- [ ] #5 Deleting the source view or database leaves the reference in a graceful 'view no longer available' state
<!-- AC:END -->
