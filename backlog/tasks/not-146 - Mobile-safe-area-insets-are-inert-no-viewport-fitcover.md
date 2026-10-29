---
id: NOT-146
title: 'Mobile: safe-area insets are inert (no viewport-fit=cover)'
status: needs-triage
assignee: []
created_date: '2026-10-10 18:03'
labels:
  - enhancement
dependencies: []
priority: low
ordinal: 141000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
index.html viewport meta lacks viewport-fit=cover, so env(safe-area-inset-*) used by the sheets and consent banner resolves to 0. Matters for the installed PWA (home indicator over bottom sheets / FAB). Turning it on also needs left/right insets in landscape.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Bottom sheets, FAB and consent banner clear the iOS home indicator in standalone PWA
- [ ] #2 No content under the notch in landscape
<!-- AC:END -->
