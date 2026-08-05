# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/dnzzl/notara/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/dnzzl/notara/releases/tag/v0.1.0
