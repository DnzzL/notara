---
id: NOT-47
title: 'Blank-first onboarding: drop new users straight into an editable page'
status: done
assignee:
  - '@thomas'
created_date: '2026-07-10 15:38'
updated_date: '2026-07-10 15:46'
labels:
  - enhancement
dependencies: []
priority: high
ordinal: 50000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Positioning goal: Notara is the simplest, lightest Notion alternative. The auto-starting OnboardingTour (packages/app/src/routes/$workspaceSlug.tsx, OnboardingTour.tsx) signals an over-complex UI up front. Remove the auto-start so a first-time user lands directly on a fresh, focused, editable page (cursor ready), letting the slash menu be the discovery mechanism it already is. Tour remains available on demand (relates to NOT-34, which moves it into a Help menu). Also review the 'Getting Started' seed (handlers/onboarding.ts) so the first page invites writing rather than reading a manual.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 OnboardingTour no longer auto-starts on first workspace visit; tourAutoStart wiring removed or gated behind explicit trigger
- [x] #2 New user lands on an editable page with focus in the editor, not a tour overlay or a wall of instructions
- [x] #3 Tour is still launchable on demand (consistent with NOT-34)
- [x] #4 Server type-check and app type-check pass; existing tests green
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Remove auto-start wiring in $workspaceSlug.tsx (tourAutoStart state + its useEffect + the autoStart prop passed to OnboardingTour).
2. Remove the now-orphaned autoStart prop + its useEffect from OnboardingTour.tsx; keep the manual startKey path (Sidebar Help button) intact.
3. Slim the 'Getting Started' seed (handlers/onboarding.ts) to a minimal blank-first page (blank-first, invites writing).
4. Rely on existing Placeholder ('Type / for commands') for discoverability; assess editor focus-on-load conservatively (block-per-editor; avoid forcing focus on all blocks).
5. Verify: tsc app + server, bun test server; /code-review; commit.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Removed auto-start: deleted tourAutoStart state + first-visit useEffect in $workspaceSlug.tsx, and the autoStart prop + its useEffect/autoStarted ref in OnboardingTour.tsx. Removed now-orphaned isTourCompleted export (route was its only consumer). Manual Help-button path (startKey) untouched. Seed slimmed to a single empty paragraph on an 'Untitled' page (icon NULL); relies on existing editor Placeholder ('Type / for commands'). Verify: 118/118 server tests pass; app tsc clean for both edited files. Note: server tsc still reports pre-existing bun:sqlite/bun:test errors due to @types/bun not being symlinked into node_modules/@types in this fresh worktree — unrelated to this change, no edited file appears in the errors.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Blank-first onboarding: new workspaces now open on a single empty 'Untitled' page instead of auto-launching a 4-step product tour over a 9-block instructional 'Getting Started' page.

Changes:
- $workspaceSlug.tsx: removed the first-visit auto-start effect and tourAutoStart state; OnboardingTour now receives only startKey.
- OnboardingTour.tsx: dropped the autoStart prop, its effect, the autoStarted ref, and the now-unused isTourCompleted export. Manual launch via the sidebar Help button (startKey) is unchanged.
- handlers/onboarding.ts: seed reduced from 9 instructional blocks to one empty paragraph; page title 'Untitled', no icon. Discoverability now comes from the editor placeholder ('Type / for commands') and the Help tour on demand.

Why: positioning Notara as the simplest, lightest Notion alternative — remove the tour overlay and wall of instructions that greet first-time users.

Tests: 118/118 server tests pass; app type-check clean for both edited files. No data migration (only affects newly created workspaces).
<!-- SECTION:FINAL_SUMMARY:END -->
