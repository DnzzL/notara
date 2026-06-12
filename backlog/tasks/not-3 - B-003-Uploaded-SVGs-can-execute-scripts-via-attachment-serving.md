---
id: NOT-3
title: 'B-003: Uploaded SVGs can execute scripts via attachment serving'
status: done
assignee: []
created_date: '2026-06-12 13:55'
updated_date: '2026-06-12 16:59'
labels:
  - bug
  - ready-for-agent
dependencies: []
references:
  - packages/server/src/handlers/upload.ts
  - 'packages/server/src/index.ts:275'
modified_files:
  - packages/server/src/index.ts
priority: high
ordinal: 3000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Upload endpoint accepts any file type. Static server maps .svg -> image/svg+xml. An uploaded SVG with embedded script tags will execute in the viewer's browser. No CSP compounds the risk.\n\nFiles: packages/server/src/handlers/upload.ts, packages/server/src/index.ts:275\n\nFix options: (a) remove image/svg+xml from MIME map, (b) sanitize SVGs on upload, (c) serve with Content-Disposition: attachment.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Uploaded SVG served as application/octet-stream or with Content-Disposition
- [x] #2 Existing image/png uploads still render inline
- [x] #3 bun --bun tsc --noEmit -p packages/server passes
- [x] #4 bun test packages/server/test passes
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
.svg removed from MIME map. SVGs now served as application/octet-stream. Image uploads for png/jpg/webp/gif unchanged.
<!-- SECTION:NOTES:END -->
