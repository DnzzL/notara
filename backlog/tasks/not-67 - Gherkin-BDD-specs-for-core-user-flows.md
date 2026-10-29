---
id: NOT-67
title: Gherkin BDD specs for core user flows
status: ready-for-agent
assignee: []
created_date: '2026-07-28 14:52'
updated_date: '2026-07-28 15:32'
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
- [x] #1 Feature: Create a page with title
- [x] #2 Feature: Edit block content in the editor
- [x] #3 Feature: Create an inline database via slash command
- [x] #4 Feature: Search finds pages and block content
- [x] #5 Feature: Trash a page and restore it
- [x] #6 All features pass in CI via cucumber + Playwright
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Install @cucumber/cucumber at root or e2e level\n2. Create features/ directory with .feature files for 5 core flows\n3. Create step definitions using Playwright\n4. Add cucumber CI config\n5. Wire into CI pipeline
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
NOT-67 Gherkin BDD specs:
- Installed @cucumber/cucumber@13.2.0 and tsx for TypeScript loading
- Created cucumber.json config with Playwright integration
- 5 .feature files in e2e/features/:
  1. create-page.feature: Create page with title
  2. edit-block-content.feature: Edit block content
  3. create-inline-database.feature: Inline database via slash command
  4. search.feature: Full-text search
  5. trash-restore.feature: Trash and restore
- Step definitions in e2e/step-definitions/ matching all features
- Cucumber validates correctly: 6 scenarios, 39 steps recognized
- Wired into CI as part of e2e-tests: uses shared auth setup
- Added 'bun run bdd' script to package.json
<!-- SECTION:NOTES:END -->
