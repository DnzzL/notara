# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.4] - 2026-08-26

A hardening release. Most of it is defects that were already in your instance —
including one that has been breaking every file upload since 5 August.

### Fixed

- **File upload and Notion import returned 500 for everyone** (NOT-123). Since
  `cb4f3ed`, every authenticated `POST /api/upload` and `POST /import-notion` failed with a
  generic error. Routing them through the workspace authorization chokepoint made them read
  a service at request time that the route did not carry. The only test on those routes
  checked that anonymous callers are refused — and that check is answered *before* the
  missing service is read, so it stayed green while nothing worked. **If uploads have been
  failing on your instance, this is why.**

- **Exporting a workspace silently overwrote pages that share a title** (NOT-111). One file
  per page, named from the title, flat: two pages called "Notes" became one file and the
  export reported success. Databases had the same problem. Names are now made unique, and
  the reported count matches what is on disk.

- **Backup retention could delete an arbitrary backup** (NOT-112). Backups were sorted by
  file modification time, so two written in the same second sorted arbitrarily — and
  retention deletes everything past the newest N. They are now ordered by the timestamp in
  their own name.

- **Re-importing a Notion export cloned everything instead of updating it** (NOT-109,
  NOT-110). Each run minted fresh identifiers for every page, database, field and record,
  with nothing persisted to recognise them next time; one workspace ended up with thirteen
  copies of every database. A second import could also delete pages the first had created,
  or a page you had made and not yet typed into, because the empty-page prune scanned the
  whole workspace. An import now updates what it created before, acts only on its own
  artifacts, and runs in a single transaction.

- **A saved view embedded as a reference block filtered and sorted differently from the same
  view opened as a table** (NOT-115). The block carried its own query implementation that
  understood operators the filter UI never emits, ignored the ones it does, and read the
  sort direction under a different name — so filters silently did nothing and sorts were
  no-ops. There is one engine now, and configurations saved either way are normalised on
  read.

- **Dates sorted alphabetically and checkboxes by the spelling of "true"** (NOT-113). Only
  numeric columns had a real comparison; everything else fell back to text. Sorting a date
  column now orders chronologically, unchecked sorts before checked, and empty cells sort
  last instead of leading the list.

- **Settings backup panel hammered `/api/backup/list`** (NOT-101). The effect that loads the

  backup list depended on a function recreated on every render, so it refired continuously —
  roughly ten requests a second for as long as the Backups panel stayed open. The loader is
  now memoized.

- **Database actions failed silently** (NOT-125). Every action in the database store called
  the server with no failure path, so a rename, delete or cell edit that failed changed
  nothing on screen and told you nothing — indistinguishable from one that was never
  attempted. The same was true of undoing a block deletion.

### Security

- **Any signed-in user could invite themselves into any workspace** (NOT-102).
  `inviteMemberByEmail` checked only that a session existed, then emailed a
  caller-supplied address a join link carrying the target workspace's invite token.
  It now requires workspace ownership, matching the member-management actions beside it.

- **Uploaded files were readable by anyone holding the URL** (NOT-103, ADR-006). Serving an
  attachment required no session at all — so an image or PDF stayed readable by a user
  removed from the workspace, by a member with no access to the page it sits on, and by
  anyone the link was ever forwarded to. An attachment is now readable exactly when its
  page is. **Attachment URLs no longer work outside a logged-in session.**

- **Installing this repository no longer runs any code.** The root `postinstall` is gone and
  dependency lifecycle scripts stay disabled, in response to the recent npm supply-chain
  compromises. Contributors run `bun run setup` deliberately after cloning; see
  `CONTRIBUTING.md`.

### Added

- **Backups to a local directory** (NOT-112). Backup was S3 or nothing, which is an odd
  answer for self-hosted software. A new `backupTarget` setting takes `off`, `s3` or
  `local`, with `localBackupDir` (or `BACKUP_DIR`) choosing where. Existing configurations
  keep working: an instance with S3 enabled is treated as `s3` without touching its
  settings.

- **S3 backup retention** (NOT-99). Backups were never pruned: every run uploads a full
  zip, so an hourly schedule left 24 complete copies of the instance in the bucket per
  day, forever. A new `s3KeepLast` setting (default 10, `S3_KEEP_LAST` env override) keeps
  only the N most recent backups and deletes the rest after each successful run; set it to
  `0` to keep everything. The purge also runs once at server startup, so a bucket that is
  already over the limit is brought back down without waiting for the next scheduled
  backup. The pre-restore safety snapshot never triggers a purge, and a failed purge is
  logged rather than failing the backup that just succeeded.

### Changed

- **An empty number cell reads as `null` rather than `0`** (NOT-116). The server decoded
  number cells with `Number(value)`, and `Number("")` is `0` — so a cell nobody had filled
  in was indistinguishable from one deliberately set to zero, in the API and in column
  totals alike. Column totals are unchanged; "filled" and "empty" counts now mean what they
  say.

- **BREAKING (`/api/v1`): block `content` is a string on the way out, and must be a string
  on the way in** (NOT-107). The REST adapter used to run `JSON.parse` on stored content
  and fall back to the raw string when that failed, so it returned an object for an image
  block and a string for a paragraph, while the RPC surface returned the string either
  way — one module with two contracts, picked by which door the caller used.

  The OpenAPI document described a third thing that matched neither: `{ "text": "…" }`
  objects for every text block. That was never what the server stored. Worse, the write
  path coerced objects to JSON, so an integrator following the document stored
  `{"text":"hi"}` where the editor expects `<p>hi</p>` — a block that renders blank, with
  nothing to say why.

  Now: content crosses both surfaces exactly as stored. Text blocks hold HTML, structured
  blocks (image, pdf, file, pageLink, database, viewReference, people) hold a JSON string.
  Sending an object is refused with 400 and a message naming the expected format instead of
  being accepted and quietly corrupted. The document has been corrected to describe what
  the server actually does.

  **If you have blocks created through `/api/v1` with object content, they are already
  broken and render blank — rewrite them as HTML.** The `notara` CLI is unaffected: its
  help text already documented HTML for text blocks.

## [0.1.3] - 2026-08-19

One change, and it's the licence: Notara is open source in the OSI sense from this
release on.

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

[Unreleased]: https://github.com/dnzzl/notara/compare/v0.1.3...HEAD
[0.1.3]: https://github.com/dnzzl/notara/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/dnzzl/notara/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/dnzzl/notara/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/dnzzl/notara/releases/tag/v0.1.0
