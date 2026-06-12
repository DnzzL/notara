---
id: NOT-1
title: 'B-001: Path traversal in attachment serving'
status: ready for agent
assignee: []
created_date: '2026-06-12 13:54'
updated_date: '2026-06-12 14:05'
labels:
  - bug
dependencies: []
references:
  - 'packages/server/src/index.ts:304-322'
priority: high
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The GET /attachments/:fileName route passes user-supplied fileName directly to path.join(dataDir, fileName) with no sanitization. An attacker can request /attachments/../../../etc/passwd and read arbitrary files.\n\nFile: packages/server/src/index.ts:304-322\nFix: Validate filename against /^[a-zA-Z0-9._-]+$/ before constructing path.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 GET /attachments/../../../etc/passwd returns 404
- [x] #2 GET /attachments/valid-file.png returns file with correct Content-Type
- [x] #3 bun --bun tsc --noEmit -p packages/server passes
- [x] #4 bun test packages/server/test passes
<!-- AC:END -->
