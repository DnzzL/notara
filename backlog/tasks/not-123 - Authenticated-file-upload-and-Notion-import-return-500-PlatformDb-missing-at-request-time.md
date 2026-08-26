---
id: NOT-123
title: >-
  Authenticated file upload and Notion import return 500: PlatformDb missing at
  request time
status: done
assignee: []
created_date: '2026-08-26 11:47'
updated_date: '2026-08-26 11:51'
labels:
  - bug
dependencies: []
priority: high
ordinal: 118000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
POST /api/upload and POST /import-notion fail with a 500 for every authenticated caller. The server logs 'Service not found: PlatformDb'.

Introduced by cb4f3ed, which routed both handlers through withAuthedWorkspace. That was the right security call, but it changed what the handlers need at request time: previously each one provided its own workspace SqlClient layer explicitly and never touched PlatformDb, whereas withAuthedWorkspace reads PlatformDb to check the caller's workspace_members row. Handlers registered on the static router do not carry that service at request time, so the lookup dies.

Nothing caught it because the only coverage these routes have is the anonymous-caller guard in route-auth.test.ts, and withAuthedWorkspace resolves the session BEFORE it reads PlatformDb — so an anonymous request still gets its 401 and the test stays green while every real upload is broken. Uploads have no other test at any level.

Confirmed reproducible on a clean checkout of main with only an end-to-end upload test added, so it is not a side effect of the attachment-access work in NOT-103 — but it does block verifying that ticket, since attachments cannot be authorized if they cannot be created.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 An authenticated member can upload an image to a page they can edit and receives the created block
- [x] #2 An authenticated member can run a Notion import
- [x] #3 Both routes still refuse anonymous and non-member callers
- [x] #4 An end-to-end test covers a successful authenticated upload, so this class of regression cannot pass silently again
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Root cause: handlers registered on the static router run with the request's context, not the layer's, so services they reach for at request time have to be handed over explicitly. Before cb4f3ed both handlers provided their own workspace SqlClient layer and never touched PlatformDb; routing them through withAuthedWorkspace made them need it, and nothing supplied it.

Fixed with a withPlatformServices helper inside staticFilesRoute that provides PlatformDb and WorkspaceDb, applied to /api/upload, /import-notion and the newly guarded /attachments route. That restores the pre-cb4f3ed idiom of providing explicitly, rather than changing how the router composes layers.

Why it hid: withAuthedWorkspace resolves the session BEFORE reading PlatformDb, so the anonymous guard in route-auth.test.ts still got its 401 and stayed green while every authenticated call 500'd. Both new tests were run against the unfixed handler and confirmed to fail first.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Restore authenticated file upload and Notion import.

POST /api/upload and POST /import-notion returned 500 for every authenticated caller since cb4f3ed, with 'Service not found: PlatformDb' in the logs. That commit correctly routed both through withAuthedWorkspace, but changed what they need at request time: they previously provided their own workspace layer and never read PlatformDb, whereas the chokepoint reads it to check the caller's workspace_members row. Handlers on the static router do not carry that service at request time.

Changes:
- index.ts: a withPlatformServices helper in staticFilesRoute provides PlatformDb and WorkspaceDb to the handlers that need them, applied to upload, Notion import, and the attachment route. This is the pre-cb4f3ed idiom of providing explicitly, not a change to layer composition.
- e2e/multiuser-access.spec.ts: an uploadPng helper that fails with the response body, plus a test that an authenticated member can import a Notion export and see the page appear.

Why nothing caught it: the only coverage on these routes was the anonymous guard, and the session check runs before the missing service is read, so the guard passed while every real call failed. Both new tests were verified red against the unfixed handlers.

Tests: server 176 pass / 0 fail; server type-check clean; biome clean; multiuser-access 12 passed.

Note: adm-zip and its types were added to root devDependencies so the e2e suite can build an export fixture. Same version already in the lockfile via packages/server, so no new dependency enters the tree.
<!-- SECTION:FINAL_SUMMARY:END -->
