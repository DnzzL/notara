---
id: NOT-43
title: Public read-only page view + share-to-web UI
status: ready for agent
assignee: []
created_date: '2026-07-09 16:15'
labels:
  - enhancement
dependencies: []
ordinal: 46000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The client half of public sharing. Detailed spec: plans/003-public-share-to-web.md. Render a shared page read-only at a public URL (no login), give editors a 'Share to web' toggle in the page menu, and add a subtle 'Made with Notara' footer on public pages. Read-only rendering reuses the editor's shared TipTap extension set with editable:false (which also sanitizes block HTML via the ProseMirror schema). Database blocks show a muted placeholder. Blocked by not-42.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 sharedExtensions and blockContent are exported from the block editor (export-only, no behavior change)
- [ ] #2 A ReadOnlyPage renderer shows the title + each block read-only via editable:false TipTap; database blocks render a muted placeholder; no zustand/presence/rpc-client workspace imports are pulled in
- [ ] #3 A /p/$token client route (no beforeLoad session gate) fetches /api/public/pages/:token and renders ReadOnlyPage, or a not-found message on 404; opening it incognito does NOT redirect to /login
- [ ] #4 The page menu has a Share-to-web toggle that enables/disables sharing and shows a copyable public URL; toggling off makes the URL 404
- [ ] #5 A subtle 'Made with Notara' footer links to the repo from public pages; bun --bun tsc --noEmit -p packages/app has no new errors
- [ ] #6 Blocked by not-42
<!-- AC:END -->
