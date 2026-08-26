---
id: NOT-120
title: One transport for every network call in the app
status: ready-for-agent
assignee: []
created_date: '2026-08-26 11:13'
labels:
  - enhancement
dependencies: []
priority: medium
ordinal: 115000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The typed RPC client is deep and correct, but eight call sites ignore it and issue raw requests, each re-implementing its own error extraction: five in the backups panel, one in the import modal, one in the admin route, and the uploader. The settings-panel request loop fixed recently lived in exactly this region.

Extend the transport to cover the REST-only endpoints — upload, import, backup and admin — and delete the raw calls, so retry, authentication and error handling are decided once rather than eight times.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Every network call in the app goes through the transport module
- [ ] #2 Error extraction is defined once, not per call site
- [ ] #3 Upload, import, backup and admin endpoints are reachable through the transport with typed failures
- [ ] #4 Uploading a file, running an import and triggering a backup all still work from the UI
<!-- AC:END -->
