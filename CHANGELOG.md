# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- **Relicensed to AGPL-3.0-or-later** (NOT-97, ADR-005). Notara is now open source in the
  OSI sense rather than fair-source: free to run, study, modify and redistribute, with the
  one obligation that a modified version offered to others — including over a network —
  comes with its source. Releases up to and including `0.1.2` shipped under FSL-1.1-ALv2
  and keep those terms, two-year Apache-2.0 tail included. Contributions are inbound =
  outbound, with no CLA.

## [0.1.2] - 2026-08-19

Makes the project presentable: a shared link renders as a card, and Enter behaves the way
every other notes app taught people it does.

### Added

- **Social cards** (NOT-94) — the app declares Open Graph and Twitter card meta with a
  1200×630 image, so a shared link renders as a card instead of a bare URL.

### Fixed

- **Enter in a paragraph creates a new block** (NOT-84) — it inserted a hard break, so a
  page written with Enter became one block full of `<br>`. Shift+Enter is now the line
  break. Splitting a paragraph, heading or quote mid-text no longer leaves the text in
  both blocks, which a stale debounced save used to cause.

### Changed

- Tagging a release now creates the GitHub Release too, with notes taken from this file
  (NOT-95).

## [0.1.1] - 2026-08-06

Fixes the published image, which shipped without any of the app's static assets.

### Added

- **Typed API error contract** (NOT-89) — every RPC method now declares an
  `ApiError` union (`AuthError`, `NotFoundError`, `ConflictError`,
  `ValidationError`, `BlockLockedError`) as tagged schemas, so failures cross the
  boundary decoded instead of as opaque defects. A missing page answers 404 rather
  than 500, and clients switch on `_tag` instead of string-matching a cause.

### Fixed

- **The favicon, PWA icons and landing-page hero video were missing in
  production.** The image build never copied `packages/app/public/`, which Vite
  copies verbatim into `dist/` — so `0.1.0` shipped without favicons,
  apple-touch-icon, the PWA icons (breaking "add to home screen") or the hero
  video and poster. Serving `.mp4` also fell through to
  `application/octet-stream`, which Safari refuses to play; the static MIME table
  gained `mp4`, `webm`, `jpeg`, `gif` and `webp`.
- The per-package server and app images ran lifecycle scripts during `bun install`
  and failed on `simple-git-hooks` (NOT-90); both now install with
  `--ignore-scripts` and apply the msgpackr patch explicitly, matching the root
  image.
- Landing-page hero: the demo CTA kept three user-agent button defaults and sat
  mismatched against the neighbouring links; the SQLite mock's checkmark was
  parked in the corner of its box (NOT-91).

### Changed

- Every biome invocation is pinned to `@biomejs/biome`. `bunx biome` resolved an
  unrelated package, so the pre-commit hook silently ran a different tool and
  formatted nothing.
- `pre-merge` now gates on `@effect/tsgo` Effect diagnostics.
- New end-to-end route-auth test: boots a real server and asserts every
  non-public route refuses anonymous callers.

## [0.1.0] - 2026-08-05

First tagged release. Notara is a self-hostable, fair-source Notion alternative:
a block editor, inline databases and real-time collaboration over one SQLite file
per workspace, in a single container.

### Added

- **Block editor** — paragraphs, headings, todos, code, toggles, callouts, images
  and PDFs. Markdown-native typing, a slimmed slash menu, and chrome that stays out
  of the way: the caret flows across blocks as one document, and `@` mentions link
  pages and people inline.
- **Inline databases** — table, board, grid and calendar views; typed fields with
  relations, select, people and page references; inline autocomplete for those rich
  cell types; sensible default columns on a new database; a Basic/Advanced split in
  the add-field popover; and an undo toast after deleting a record.
- **Saved views** — save, reset and default a filtered view, with a dirty-state
  indicator, plus a `/view` block that embeds a saved view read-only on another page.
  View config changes propagate live over SSE.
- **Real-time collaboration** — invite by email or link, presence avatars, per-block
  locking, and live sync of blocks and page metadata.
- **Full-text search** across page titles and block content, excluding trashed items.
- **Trash & restore** with soft-delete, one-click restore and retention-based purge.
- **Import / Export** — Notion Markdown and CSV in, export back out.
- **Optional S3 backups** to any S3-compatible bucket, configured at runtime.
- **Sidebar as a file browser** — modifier-free page nesting via vertical-thirds
  drag, quieter chrome, and Import/Trash moved into the workspace dropdown.
- **One tabbed Settings surface**, replacing the previous set of separate modals.
- **Blank-first onboarding** — new workspaces open straight into an editable page.
- **REST API** at `/api/v1` with API-key auth, interactive docs at `/api/docs` and an
  OpenAPI document at `/api/v1/openapi.json`.
- **`notara` CLI** — scriptable client over the REST API, published to JSR.
- **Desktop app** — Electron build for macOS.
- **Self-hosting** — single container, SQLite on a mounted volume, optional SMTP,
  Google OAuth, admin panel and opt-in PostHog analytics.
- **Licensed FSL-1.1-ALv2** (fair-source; converts to Apache-2.0 two years per
  release), with GDPR consent banner, privacy policy and terms pages.
- **Hosted demo mode** (`DEMO_MODE`, off by default) — a visitor gets a throwaway,
  isolated workspace with no signup, purged automatically after `DEMO_TTL_HOURS`.
  Read at runtime, so the published image serves demo and normal instances alike.
- **Test and quality infrastructure** — unit, property-based, E2E (including a
  two-user multiuser suite and full database-CRUD coverage), Gherkin BDD specs,
  visual regression snapshots, Biome lint, an Effect error-channel check, and a
  bundle-size/Lighthouse performance gate, all wired into CI.

### Security

Six HTTP routes reached workspace data without proving who the caller was. All
were pre-release, so no released version is affected.

- `GET`/`POST /api/settings` and `POST /api/backup/trigger` had no authentication.
  The GET disclosed the S3 access key and secret; chained with the POST and the
  trigger, an anonymous caller could repoint backups at their own bucket and have
  the instance write itself there.
- `POST /api/upload` and `POST /import-notion` took the target workspace from a
  client-supplied header and never checked membership, so anyone knowing a
  workspace id could write attachments, blocks, pages and databases into it.
- `GET /api/stream/view-config` subscribed callers with no session and no
  workspace scoping.
- All six now go through the documented chokepoints (`requireAdmin`,
  `withAuthedWorkspace`, `resolveWorkspaceContext`), and a route-auth test boots a
  real server to assert every non-public route refuses anonymous callers.

### Fixed

Defects found and fixed during pre-release development:

- Path traversal in attachment serving, and uploaded SVGs able to execute scripts.
- `reorderPages` and the workspace membership RPCs (member list, invite rotation,
  member eviction) ran unauthenticated.
- Added a Content-Security-Policy header and rate limiting on the upload endpoint.
- Live collaboration crashes: `insertBefore`/`removeChild` DOM errors when a peer
  focused or edited a block, and on ArrowDown block navigation.
- Presence avatars never disappeared — no leave event and no TTL-driven refresh.
- Peer changes to page title, icon and cover never reached other viewers.
- Invite links joined the workspace but dropped the invitee on `/workspaces`.
- `BlockLocked` lost its reason over RPC, making the lock toast unreachable.
- Sidebar drag-and-drop: nest hit-zones now track the cursor rather than the dragged
  chip, aborted drags no longer leave a stuck shadow, and the gutter click overlay no
  longer swallows the drag handle and `+` button.
- Popovers reposition when their content grows instead of pushing the primary action
  off-screen; outside-click handling no longer swallows portalled dropdown clicks.
- Mobile: the hamburger sidebar drawer didn't open, and database tables had no
  responsive layout.
- Search returned deleted pages and blocks.
- Last-viewed page and workspace didn't persist across sessions; board/table view mode
  didn't persist with saved views.
- Unchecked todos rendered struck through.
- Admin user deletion left orphaned workspaces.
- Added missing database indexes on hot query paths.

[Unreleased]: https://github.com/dnzzl/notara/compare/v0.1.2...HEAD
[0.1.2]: https://github.com/dnzzl/notara/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/dnzzl/notara/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/dnzzl/notara/releases/tag/v0.1.0
