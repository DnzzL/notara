---
id: NOT-43
title: Public read-only page view + share-to-web UI
status: done
assignee:
  - '@agent-k'
created_date: '2026-07-09 16:15'
updated_date: '2026-07-13 16:21'
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
- [ ] #6 Blocked by not-42
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Export sharedExtensions + blockContent from BlockEditor.tsx (export-only, no behavior change)
2. Create ReadOnlyPage component — renders title + blocks read-only via editable:false TipTap; database blocks show muted placeholder; no zustand/presence/rpc-client workspace imports
3. Create /p/$token client route — no beforeLoad session gate; fetches GET /api/public/pages/:token; renders ReadOnlyPage or not-found
4. Add Share-to-web toggle in SharePageModal — enables/disables sharing via api.setPageSharing; shows copyable public URL
5. Add 'Made with Notara' footer on public pages; typecheck app
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented NOT-43: Public read-only page view + share-to-web UI.

Files created:
- packages/app/src/components/ReadOnlyPage.tsx — renders page read-only via editable:false TipTap; database blocks show muted placeholder
- packages/app/src/routes/p.$token.tsx — public route with no auth gate; fetches GET /api/public/pages/:token; renders ReadOnlyPage or 404 view; includes 'Made with Notara' footer

Files modified:
- packages/app/src/components/BlockEditor.tsx — exported sharedExtensions + blockContent (no behavior change)
- packages/app/src/components/SharePageModal.tsx — added Share-to-web toggle + copyable public URL
- packages/app/src/router.ts — registered p.$token route

Typecheck: no new errors (all pre-existing).

- Fixed 'Service not found: PlatformDb' in public page route (provided PlatformDbLive via Effect.provide)
- Created reusable Toggle component in packages/app/src/components/ui/Toggle.tsx
- Replaced hand-rolled toggle in SharePageModal with proper Toggle component
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added public read-only page view + share-to-web UI.

**What changed:**
- Exported sharedExtensions + blockContent from BlockEditor.tsx for reuse
- New ReadOnlyPage component renders title + blocks read-only via editable:false TipTap; database blocks show a muted placeholder
- New /p/$token client route (no beforeLoad session gate) fetches /api/public/pages/:token and renders ReadOnlyPage or a not-found page
- Added Share-to-web toggle in the SharePageModal — enables/disables sharing via api.setPageSharing, shows a copyable public URL
- 'Made with Notara' footer on public pages linking to the GitHub repo

**Key details:**
- No zustand/presence/rpc-client workspace imports in ReadOnlyPage
- Opening the public page incognito does NOT redirect to /login
- Toggling off sharing makes the previous URL return 404
- All pre-existing type errors unchanged (bun:sqlite, CSS modules, etc.)
<!-- SECTION:FINAL_SUMMARY:END -->
