---
id: NOT-15
title: 'B-012: Add rate limiting to file upload endpoint'
status: done
assignee:
  - '@thomas'
created_date: '2026-06-12 13:56'
updated_date: '2026-06-12 14:14'
labels:
  - enhancement
dependencies: []
references:
  - packages/server/src/index.ts
priority: low
ordinal: 15000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
POST /api/upload has no rate limiting. For a self-hosted instance this is self-policing, but a misconfigured script or page script could fill the disk.\n\nFile: packages/server/src/index.ts (upload route)\n\nFix: Add IP-based rate limiter (e.g., 60 req/min per IP) matching the auth mutation pattern.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Upload endpoint returns 429 after exceeding rate limit
- [x] #2 Legitimate uploads at normal pace succeed
- [x] #3 bun --bun tsc --noEmit -p packages/server passes
- [x] #4 bun test packages/server/test passes
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add IP-based rate limiter to POST /api/upload endpoint\n2. Match the existing auth mutation pattern (checkRateLimit + getIp)\n3. Return 429 after exceeding limit\n4. Verify with tsc and tests
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Added IP-based rate limiting (60 req/min) to POST /api/upload matching the auth mutation pattern
<!-- SECTION:NOTES:END -->
