---
id: NOT-12
title: 'B-015: Improve error detail in catchAllCause 500 responses'
status: done
assignee: []
created_date: '2026-06-12 13:56'
updated_date: '2026-06-12 16:42'
labels:
  - enhancement
  - ready-for-agent
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
- [x] #1 Development 500 responses include error message
- [x] #2 Production 500 responses remain generic (no stack leakage)
- [x] #3 bun --bun tsc --noEmit -p packages/server passes
- [x] #4 bun test packages/server/test passes
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Decision: Fix catchAllCause in index.ts HTTP routes (import-notion, settings, backup trigger, backup list, backup restore — 5 instances) to:
1. For Fail (expected errors like validation): pass through message as-is (already done in most places)
2. For defects (unexpected errors): log via Effect.logError('Unhandled error', cause) and return JSON { error: 'Something went wrong' } with status 500 — currently leaks stack traces via cause.toString()

RPC handlers NOT in scope (they use Effect.orDie pattern which is a separate concern).

Changes applied:
- Fixed all 7 catchAllCause handlers in packages/server/src/index.ts:
  1. Auth handler (lines 118-124)
  2. Settings POST (lines 159-165)
  3. Backup trigger (lines 175-181)
  4. Backup list (lines 212-218)
  5. Backup restore (lines 239-245)
  6. Import-notion (lines 334-341) — added missing reportError
  7. Upload (lines 382-388) — added missing reportError
- Each handler now differentiates Fail (pass through) vs defects (generic message + Effect.logError)
- Checked api-v1/routes.ts — no catchAllCause patterns found
- Verified: tsc --noEmit passes (0 errors), all 118 tests pass
<!-- SECTION:NOTES:END -->
