---
id: NOT-12
title: 'B-015: Improve error detail in catchAllCause 500 responses'
status: needs human validation
assignee: []
created_date: '2026-06-12 13:56'
updated_date: '2026-06-12 14:05'
labels:
  - enhancement
dependencies: []
references:
  - packages/server/src/index.ts
priority: low
ordinal: 12000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Many route handlers wrap in catchAllCause and return generic 500 JSON. Defects produce JSON error response but original stack trace is only in console.error. Include error message in 500 response body for non-production environments.\n\nFiles: Throughout packages/server/src/index.ts and api-v1/routes.ts
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Development 500 responses include error message
- [ ] #2 Production 500 responses remain generic (no stack leakage)
- [ ] #3 bun --bun tsc --noEmit -p packages/server passes
- [ ] #4 bun test packages/server/test passes
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Task says 'non-production environments' — how does this codebase detect dev vs prod? Check for NODE_ENV, a build flag, or something custom? Needs a human to confirm the detection mechanism before implementing.
<!-- SECTION:NOTES:END -->
