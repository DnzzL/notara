---
id: NOT-67
title: Gherkin BDD specs for core user flows
status: ready-for-agent
assignee: []
created_date: '2026-07-28 14:52'
updated_date: '2026-07-28 14:53'
labels:
  - enhancement
dependencies:
  - NOT-63
ordinal: 70000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add @cucumber/cucumber with Playwright integration. Write .feature files for the five core user flows: create page, edit block content, create inline database, full-text search, and trash/restore. Wire step definitions so these execute as tests in CI. These become the English-spec that agents must satisfy.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Feature: Create a page with title
- [ ] #2 Feature: Edit block content in the editor
- [ ] #3 Feature: Create an inline database via slash command
- [ ] #4 Feature: Search finds pages and block content
- [ ] #5 Feature: Trash a page and restore it
- [ ] #6 All features pass in CI via cucumber + Playwright
<!-- AC:END -->
