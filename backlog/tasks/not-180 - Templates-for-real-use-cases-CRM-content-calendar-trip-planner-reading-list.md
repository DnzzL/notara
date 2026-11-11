---
id: NOT-180
title: >-
  Templates for real use cases: CRM, content calendar, trip planner, reading
  list
status: done
assignee: []
created_date: '2026-11-11T13:21:00Z'
updated_date: '2026-11-11T13:32:00Z'
labels:
  - enhancement
milestone: m-3
dependencies:
  - NOT-181
priority: high
ordinal: 153000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Why: the 4 current templates in packages/server/src/handlers/templates.ts (engineering-wiki, project-tracker, meeting-notes, bug-tracker) are all dev-flavoured. A non-developer needs something useful on day one. Add 4, each with a database, views and realistic sample rows:
- Personal CRM / contacts: people, last contact, next follow-up, board by stage.
- Content calendar: ideas → drafting → published, board + table, publish date.
- Trip or event planner: itinerary, bookings, budget, guest list (relation).
- Reading / learning list: status, rating, notes sub-pages.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 listTemplates returns the 4 new templates alongside the existing ones
- [x] #2 Each new template can be created over REST and MCP using the existing operations
- [x] #3 Creating a template yields a database with working views and realistic sample rows
- [x] #4 A test instantiates every template (old and new) and asserts its views resolve
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added 4 templates (personal-crm, content-calendar, trip-planner, reading-list) to templates.ts, each with table + board views and realistic sample rows; trip planner uses a Guests relation, reading list links notes sub-pages. New server test instantiates all 8 templates and asserts pages, databases, fields, views, records. REST/MCP use the existing createPageFromTemplate op. Tests: 385 pass.
<!-- SECTION:FINAL_SUMMARY:END -->
