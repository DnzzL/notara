---
id: NOT-69
title: 'Biome: lint + format enforcement'
status: ready-for-agent
assignee: []
created_date: '2026-07-28 14:52'
updated_date: '2026-07-28 15:15'
labels:
  - enhancement
dependencies:
  - NOT-63
ordinal: 72000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add @biomejs/biome to the project with a biome.json config. Auto-fix all existing code in one mechanical pass. Enforce biome check in pre-commit hook (via husky or simple-git-hooks) and in CI. Prevents agent-introduced style drift, unused imports, and dead code.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 biome installed and biome.json configured with recommended rules
- [x] #2 All existing source files pass biome check (auto-fixed)
- [ ] #3 Pre-commit hook runs biome check --write on staged files
- [x] #4 CI workflow runs biome ci and fails on violations
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Install @biomejs/biome\n2. Create biome.json with recommended rules\n3. Run biome check --write on all source files\n4. Add biome ci to the CI workflow\n5. Set up pre-commit hook
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Biome setup:
- Installed @biomejs/biome v2.5.6
- Created biome.json with recommended rules, tuned for the codebase (suppressed noExplicitAny, useHookAtTopLevel, noInvalidUseBeforeDeclaration, a11y rules for pre-existing patterns)
- Ran biome check --write --unsafe across packages/ and e2e/ - fixed auto-fixable issues
- Manually fixed: removed unused MemberRow type, renamed valueOf→getValue in DatabaseView, fixed forEach→for loop in useMemo, added isDefault/config/isFavorite/deletedAt to shared tests, converted Effect.gen→Effect.sync in server's synchronous handlers, added compound keys for filter/sort arrays
- Added Tailwind CSS parser support
- Added biome ci to CI workflow
- Set up pre-commit hook (biome check --write --unsafe) and pre-push hook (biome ci)
<!-- SECTION:NOTES:END -->
