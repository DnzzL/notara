---
id: NOT-143
title: 'CSS reset never applies: comment in styles.css closes early'
status: done
assignee:
  - '@claude'
created_date: '2026-10-10 18:03'
updated_date: '2026-10-10 18:13'
labels:
  - bug
dependencies: []
priority: high
ordinal: 138000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
styles.css:130 comment contains 'p-*/m-*'; the '*/' ends the comment, so the rest of the comment plus '@layer base { * { margin:0; padding:0; box-sizing:border-box } ... }' is parsed as one invalid rule and dropped. Since the initial release: body keeps its 8px UA margin (grey band + inset topbar on mobile), box-sizing is content-box everywhere, form controls don't inherit font. Fixing the comment changes layout app-wide (UI was tuned against the broken state) → needs a visual pass.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Reset rule is present in the served CSS and body margin is 0
- [x] #2 Main screens (landing, auth, workspace, editor, database views, settings) reviewed at 390px and desktop after the fix
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Capture before screenshots (desktop 1280 + mobile 390) of main screens
2. Fix the comment so the @layer base reset parses
3. Same screenshots after; diff visually; fix regressions the reset introduces
4. Typecheck + app tests
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The CSS reset now applies (it never had since the initial release).

Changes:
- styles.css: comment no longer contains a star-slash, so @layer base { * { margin:0; padding:0; box-sizing:border-box } } parses
- Fallout from the reset: page title lost a duplicate mb-7 that only the UA h1 margin-top had been hiding; editor bullet/numbered lists get padding-left 1.5em (UA 40px gone); landing AGPL badge nowrap
- test/styles-reset.test.ts guards against a stray comment end swallowing the reset (red on the old CSS)

Visual pass, before/after at 1280x800 and 390x844: landing, login, workspaces, page + database (table, board, menus), settings, privacy, docs, terms, bullet list. Spurious 16px page scroll gone everywhere.

Tests: app tsc clean, bun test packages/app 156 pass.
<!-- SECTION:FINAL_SUMMARY:END -->
