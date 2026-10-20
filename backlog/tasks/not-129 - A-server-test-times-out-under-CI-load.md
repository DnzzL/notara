---
id: NOT-129
title: A server test times out under CI load
status: needs-triage
assignee: []
created_date: '2026-08-27 15:45'
labels:
  - bug
dependencies: []
priority: low
ordinal: 124000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
'typed handler failures > moving a page into itself fails with ConflictError' failed in CI at 5958ms against bun test's 5000ms default. It passes locally, where the whole server suite runs in about 4 seconds for 238 tests — so this one test is doing something disproportionate, or the CI runner is slow enough to matter and the margin was always thin.

Not caused by the E2E job added in NOT-126: that runs on a separate runner.

Worth establishing which before reaching for a longer timeout. A test that needs six seconds to prove a page cannot be moved into itself is suspicious on its own — the check should be a cycle detection, not a traversal that could be doing work proportional to the page tree.

If it turns out to be genuinely slow rather than flaky, the fix is in the handler, not the timeout.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Established whether the test is slow or the assertion is slow
- [ ] #2 CI passes this test consistently, without simply raising the timeout to hide it
<!-- AC:END -->
