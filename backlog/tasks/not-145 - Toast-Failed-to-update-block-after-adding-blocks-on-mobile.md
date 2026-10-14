---
id: NOT-145
title: Toast 'Failed to update block' after adding blocks on mobile
status: wontfix
assignee: []
created_date: '2026-10-10 18:03'
updated_date: '2026-10-14 14:07'
labels:
  - bug
dependencies: []
priority: medium
ordinal: 140000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Seen once at 390px emulation: tapping 'New block' then 'Add block' on a fresh page showed 'Failed to update block'. Server log had no error status (RPC error inside a 200). Repro not yet isolated.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Root cause identified and repro written as a test
- [ ] #2 No error toast when adding blocks on a fresh page
<!-- AC:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: @agent
created: 2026-10-14 14:07
---
Won't do : antérieur à la bascule agent-first (backlog humains/agents, NOT-148..157).
---
<!-- COMMENTS:END -->
