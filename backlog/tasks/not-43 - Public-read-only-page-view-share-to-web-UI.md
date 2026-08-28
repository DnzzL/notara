---
id: NOT-43
title: Public read-only page view + share-to-web UI
status: done
assignee: []
created_date: '2026-07-09 16:15'
updated_date: '2026-08-28 06:58'
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
- [x] #1 sharedExtensions and blockContent are exported from the block editor (export-only, no behavior change)
- [x] #2 A ReadOnlyPage renderer shows the title + each block read-only via editable:false TipTap; database blocks render a muted placeholder; no zustand/presence/rpc-client workspace imports are pulled in
- [x] #3 A /p/$token client route (no beforeLoad session gate) fetches /api/public/pages/:token and renders ReadOnlyPage, or a not-found message on 404; opening it incognito does NOT redirect to /login
- [x] #4 The page menu has a Share-to-web toggle that enables/disables sharing and shows a copyable public URL; toggling off makes the URL 404
- [x] #5 A subtle 'Made with Notara' footer links to the repo from public pages; bun --bun tsc --noEmit -p packages/app has no new errors
- [x] #6 Blocked by not-42
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The client half of public sharing: a shared page renders read-only at /p/$token with no login, and editors get a Share-to-web toggle.

Rendering reuses the editor's own TipTap schema at editable:false. That is not just consistency of appearance — ProseMirror drops any markup its schema does not know, so passing stored HTML through this set is what sanitises it. A bespoke renderer would be a second sanitiser to keep in step, and the one facing the open web is the wrong one to fall behind.

- components/editorSchema.ts lifts sharedExtensions/blockContent out of BlockEditor.tsx (re-exported there, so AC1's 'exported from the block editor' still holds). The lift is what makes AC2 true rather than aspirational: importing them from BlockEditor would drag in the store, the RPC client and the presence connection, none of which a public reader can use. Behaviour unchanged.
- components/ReadOnlyPage.tsx renders title + blocks. Media blocks are three tags rather than the block-renderer registry, which imports every renderer at module load including the ones that reach for the store. pageLink/database/viewReference/people show a muted placeholder — the server already blanked them (NOT-42); this file only says so politely.
- lib/publicAssets.ts repoints /attachments/<file> at /api/public/pages/<token>/attachments/<file>. Rewriting rather than storing the public URL keeps stored content identical whether or not a page is shared, so revoking does not mean rewriting every block back. The regex alternates over the already-public form so a re-render cannot nest the prefix.
- routes/p.$token.tsx has no beforeLoad, deliberately: every other route gates on a session and the point of this one is that the reader has none. Fetches over restCall, not the RPC client (which carries a workspace id and a session). Every failure renders one message — the server answers every no with the same 404, and so does this.
- ShareToWebSection lives inside the share modal rather than beside it in the page menu: 'who can see this' is one question, and answering it in two places invites a page locked to three people AND published to everyone. Hidden without editor rights rather than shown disabled. The URL is built from window.location.origin, so a self-hoster has nothing to configure.
- A quiet 'Made with Notara' footer links the repo.

Tests: 376 unit tests pass (7 new in publicAssets.test.ts covering idempotence and leaving unrelated URLs alone); tsc clean on server, app and the test project; e2e/rest-public-share.spec.ts is now 8 tests, adding an incognito browser context that renders the page and gets the not-available message after revoking, and a UI test driving the modal toggle and checking the URL it shows actually serves the page.
<!-- SECTION:FINAL_SUMMARY:END -->
