---
id: NOT-6
title: 'B-004: Add Content-Security-Policy header'
status: ready for agent
assignee: []
created_date: '2026-06-12 13:55'
updated_date: '2026-06-12 15:54'
labels:
  - enhancement
  - ready-for-agent
dependencies: []
references:
  - 'packages/server/src/middleware.ts:15-19'
priority: medium
ordinal: 6000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The securityHeaders object includes X-Content-Type-Options, X-Frame-Options, Referrer-Policy, and Permissions-Policy — but no CSP. Any XSS vector is fully exploitable.\n\nFile: packages/server/src/middleware.ts:15-19\n\nSuggested policy: default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; script-src 'self' https://eu.i.posthog.com; connect-src 'self' https://eu.i.posthog.com wss:; frame-ancestors 'none'
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 All app pages load without CSP violations in browser console
- [ ] #2 Inline styles in TipTap editor still work
- [ ] #3 PostHog analytics still loads
- [ ] #4 bun --bun tsc --noEmit -p packages/server passes
- [ ] #5 bun test packages/server/test passes
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Decision: Add CSP to securityHeaders in middleware.ts. No Google Fonts in app — fonts are self-hosted. PostHog from eu.i.posthog.com. Policy:

default-src 'self';
script-src 'self' https://eu.i.posthog.com;
style-src 'self' 'unsafe-inline';
connect-src 'self' https://eu.i.posthog.com wss:;
img-src 'self' data: blob:;
font-src 'self';
frame-ancestors 'none';
form-action 'self'

Test that all app pages load without CSP violations, TipTap editor still works, PostHog analytics fires.
<!-- SECTION:NOTES:END -->
