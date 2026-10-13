# Spec: Shared Backlog for Humans and Agents

Decision: `docs/adr/012-notara-is-a-queue-backend.md`. No code yet; seams below are
proposals to confirm before building behind them.

## Goal

Notara becomes **"The AI-first Notion alternative: notes, docs and one backlog your team
and your agents share."** Done when Notara's own backlog lives in a Notara database instead
of `backlog/`, and its author plus at least two different agents pick, work and close cards
there through a runner.

## Non-goals (v1)

Claim, lease or transition rules · agents as workspace members · MCP server · webhooks ·
email notifications · comment threads or block-anchored comments · a `Card` entity ·
role mapping stored in Notara.

## Model

- **Card** = a record of any database. Status and agent are `select` options whose meaning
  the runner's config defines. Acceptance criteria = the to-do blocks of the record's page.
- **Short id** = `PREFIX-n`, a per-database prefix plus a sequential counter. Shown in the
  UI, accepted wherever a record id is.
- **Comment** = flat markdown on a page, authored by the principal; shows the API key name
  when written through a key. Author-only edit and delete.
- **Handle** = unique per workspace member, derived from the name on join, editable.
  `@handle` in a comment is a mention.
- **Inbox** = one entry per mention, and per comment on a record where the user is in a
  `people` field. Read/unread per user; badge pushed over the existing SSE channel.

## Seams (shipped unless noted)

REST `/api/v1` additions, the contract a runner's adapter depends on:

| Operation | Shape | Serves |
|---|---|---|
| List records, filtered | `GET /databases/:id/records?field=<id or name>&value=<v>` (repeatable, AND) | `List` |
| Get record | `GET /databases/:dbId/records/:idOrShortId` → record, field values, `body` markdown, `criteria` `[{text, checked}]` | `Get` |
| List comments | `GET /pages/:id/comments` | thread in the briefing |
| Add comment | `POST /pages/:id/comments {body}` → `Comment` (`authorId`, `keyName`, …) | `Comment` |
| Write criteria | to-do blocks via the existing blocks API | `CriterionWriter` |
| Close / phase / assign | existing `PUT` record field value | `Close`, `Phaser`, `Assigner` |

Schema additions: `comments`, `inbox_entries`, member `handle`, database `short_prefix` +
counter, record `short_number`.

## Human surface

- Comment panel on every page (records included), with `@` completion over handles.
- Inbox: unread badge in the sidebar, list of entries, mark read, jump to the page.
- Short id on cards in board/table views and on the record page.
- README + `LandingPage.tsx` tagline; a doc page "Shared backlog for humans and agents"
  that names no runner.

## Migration (one-shot)

A script imports `backlog/` (tasks, `completed/`, `archive/`) into a Notara database
through the API, keeping a source → target id table (Notara import is not idempotent):

| Backlog.md | Notara |
|---|---|
| `NOT-xxx` | short id with the same number (the import alone may set it) |
| status | `select` Status, same words |
| assignee | `select` Agent |
| labels / priority | `multiSelect` / `select` |
| AC | to-do blocks |
| description, plan, notes, final summary | sections of the record page |
| comments | comments; original author written in the text |
| completed / archived | Status `done` |

After the import, `CLAUDE.md`, `docs/agents/issue-tracker.md` and the `to-tickets` skill
point at the runner's CLI; Backlog.md is retired.

## Constraints

- SQLite FK pragma is off: hard-deleting a page deletes its comments and inbox entries
  explicitly.
- No third-party SDK, so `/privacy` is unchanged. No handles or comment text in PostHog
  properties.
- API key write scope covers comments; reading comments follows page access.

## Known gaps

- `not done` — a full page opened from a record shows nothing of its record (short id,
  fields): NOT-158.
- `not done` — `@` completion in the comment box only, not while editing a comment;
  comments render as plain text, not markdown.
- `fragile` — trashing or restoring a page hides or shows its inbox entries but does not
  push a new unread count; the badge corrects on the next event or reload.
- `fragile` — a member removed from a workspace keeps their mention rows on old comments;
  the inbox ignores them (no access), nothing else reads them yet.
- `not tested` — no browser run of the comment panel, inbox or settings UI.
- `untouched` — the runner-side adapter (outside this repo) and the cut-over from
  Backlog.md: NOT-157.
