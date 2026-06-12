---
id: NOT-3
title: 'B-003: Uploaded SVGs can execute scripts via attachment serving'
status: needs human validation
assignee: []
created_date: '2026-06-12 13:55'
updated_date: '2026-06-12 14:05'
labels:
  - bug
dependencies: []
references:
  - packages/server/src/handlers/upload.ts
  - 'packages/server/src/index.ts:275'
priority: high
ordinal: 3000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Upload endpoint accepts any file type. Static server maps .svg -> image/svg+xml. An uploaded SVG with embedded script tags will execute in the viewer's browser. No CSP compounds the risk.\n\nFiles: packages/server/src/handlers/upload.ts, packages/server/src/index.ts:275\n\nFix options: (a) remove image/svg+xml from MIME map, (b) sanitize SVGs on upload, (c) serve with Content-Disposition: attachment.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Uploaded SVG served as application/octet-stream or with Content-Disposition
- [ ] #2 Existing image/png uploads still render inline
- [ ] #3 bun --bun tsc --noEmit -p packages/server passes
- [ ] #4 bun test packages/server/test passes
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Three fix options, needs a decision: (a) remove image/svg+xml from MIME map so SVGs download instead of rendering inline, (b) sanitize SVGs on upload to strip scripts, (c) serve with Content-Disposition: attachment. Which approach?
<!-- SECTION:NOTES:END -->
