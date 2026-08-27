---
id: NOT-126
title: auth.setup.ts blocks the whole chromium E2E suite locally
status: done
assignee:
  - '@thomas'
created_date: '2026-08-27 08:03'
updated_date: '2026-08-27 15:35'
labels:
  - bug
dependencies: []
priority: medium
ordinal: 121000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Every spec in the chromium Playwright project depends on the setup project, and the setup times out clicking 'Create an account' on /login. Playwright reports the element resolved but never became 'visible, enabled and stable' — so it is present and something is sitting over it or moving it, most likely the cookie consent banner whose dismissal at the top of the setup is wrapped in a try that swallows its own failure.

Consequence: editor-enter, block-types, database-crud, database-views, board-drag-drop, popover-positioning and visual-regression cannot be run on a developer machine at all. The multiuser and rest projects are unaffected, because they sign up their own users over HTTP rather than through the UI.

This is worth more than its Medium priority: CI does not run Playwright either (ci.yml runs lint, effect-error-channels, both type-checks and unit tests), so a spec in the chromium project is currently run by nobody, anywhere. NOT-96 is the immediate case — its acceptance criterion asks for an e2e in editor-enter.spec.ts, which would be a test that never executes.

Ruled out while diagnosing: it is not stale local .data, and it is not a leftover account — the setup uses a timestamped email. An earlier failure with the same symptom turned out to be a broken node_modules ('Cannot find module unique-string' from Vite), fixed by a clean reinstall; this one survives that.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The setup completes on a developer machine with no manual steps
- [x] #2 The consent banner no longer blocks it, and a failure to dismiss it fails loudly rather than being swallowed
- [x] #3 One chromium spec is demonstrated running locally end to end
- [x] #4 Decide whether CI should run the E2E suite at all — a project no one runs is worse than no project
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
THE CAUSE WAS NOT WHAT ANY OF US THOUGHT, mine included. It was a Vite error overlay.

vite-plugin-pwa had devOptions.enabled: true, and its dependency chain (workbox → tempy → unique-string) does not resolve under the dev server. Vite answers an unresolvable import with a full-page <vite-error-overlay>, which intercepts every pointer event. Playwright reported the button as resolved but never "stable" — so the failure looked like an animation or an overlay of ours, and I chased both.

What actually gave it away was reading the full waiting-for output rather than the summary line: "<vite-error-overlay> intercepts pointer events". It was in the log the whole time.

Wrong guesses recorded so they are not repeated: stale local .data (no — the setup uses a timestamped email), a leftover account (no), the cookie consent banner (no — though seeding consent is kept, it is deterministic and cheap), an animation on .auth-card (no — measured the bounding box across 1.2s and it does not move).

Production is unaffected: vite build resolves the same chain, which is why v0.1.4 shipped fine. Dev only.

Also fixed while here:
- The setup project had no `use` config at all, so it ran at Playwright bare defaults while every spec depending on it ran as Desktop Chrome. Aligned.
- reducedMotion: "reduce" for all projects. Standard E2E practice, and the app already honours it for its landing reveals.
- The webServer command began with `set -a && . ./.env`, which cannot succeed in CI where no .env exists — so the server would never have started there. Made tolerant.
- The consent dismissal now seeds localStorage before render instead of racing a banner, and throws with a pointer to consent.ts if the banner appears anyway. The old version swallowed its own failure, which is a large part of why this was hard.

AC 4 answered: yes, CI should run them. A suite nobody runs is worse than none — it reads as coverage on the dashboard while protecting nothing, which is exactly the state these specs were in. Added as a separate job so a browser download does not sit in front of the type-checks and unit tests, with the HTML report uploaded on failure.

79 E2E now pass locally, chromium included, for the first time.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Make the E2E suite run — locally and in CI.

The chromium project could not start on a developer machine, and CI never invoked Playwright at all, so every spec in that project had been executed by nobody for as long as it existed. That is worse than having no suite: it reads as coverage while protecting nothing.

The cause was a Vite error overlay, not any of the things it looked like. vite-plugin-pwa ran in dev, its dependency chain (workbox → tempy → unique-string) does not resolve under the dev server, and Vite answers an unresolvable import with a full-page overlay that intercepts every click. Playwright reported the button as resolved but never stable, which sent me through stale local data, a leftover account, the cookie banner and a CSS animation before I read the full waiting-for output where it said so plainly. Production is unaffected — vite build resolves the same chain.

Also fixed: the setup project ran at Playwright bare defaults while everything depending on it ran as Desktop Chrome; reducedMotion is now emulated everywhere; the consent banner is seeded away before render rather than raced, and says so loudly if it appears anyway; and the webServer command began with a source of .env that cannot succeed in CI, so the server would never have started there.

CI gains an e2e job, separate so a browser download does not sit in front of the type-checks, with the report uploaded on failure.

79 E2E pass locally, chromium included, for the first time.
<!-- SECTION:FINAL_SUMMARY:END -->
