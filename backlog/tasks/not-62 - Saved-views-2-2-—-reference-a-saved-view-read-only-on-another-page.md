---
id: NOT-62
title: Saved views 2/2 — reference a saved view read-only on another page
status: done
assignee:
  - '@thomas'
created_date: '2026-07-20 10:05'
updated_date: '2026-07-20 14:13'
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
- [x] #1 A slash command inserts a view-reference block; a picker chooses a source database and one of its saved views
- [x] #2 The block renders the chosen view (table/board/calendar) read-only — no record creation, deletion, or inline cell edits
- [x] #3 Editing the source view's config updates what the reference displays (single source of truth; config not copied onto the consuming page)
- [x] #4 If the viewer lacks access to the source view's owning page, the block renders a locked/empty state and no record data is fetched (uses getViewPageId/checkViewPermission)
- [x] #5 Deleting the source view or database leaves the reference in a graceful 'view no longer available' state
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
AC#3 implemented via SSE: server publishes config change events on updateView, client EventSource subscribes and re-fetches/re-applies config without page reload. Full AC coverage now: AC#1,2,3,4,5 all checked.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
ViewReferenceBlock implementing all 5 acceptance criteria:

AC#1 — Slash command /view (👁️ icon) inserts a view-reference block; picker for database + view selection.
AC#2 — Read-only table/board/calendar rendering with no record creation, deletion, or inline edits.
AC#3 — SSE-based reactive config propagation: server publishes view.configChanged events on updateView; client EventSource subscribes, re-fetches config, and re-applies filters/sorts/type/groupBy.
AC#4 — Permission check via checkPagePermission before loading data; locked state when denied.
AC#5 — Graceful 'Database not found' / 'View not found' when source is deleted.

15+13 tests, server-side SSE module (view-config-stream.ts) following presence route pattern.
<!-- SECTION:FINAL_SUMMARY:END -->
