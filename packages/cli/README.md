# @notion-alt/cli — `notara`

A command-line client for Notara, built with [`@effect/cli`](https://effect.website/docs/guides/command-line). It talks to the documented REST API (`/api/v1`) using an API-key bearer token. Every command accepts `--json` for machine-readable output, which makes it convenient to drive from scripts or an LLM.

## Setup

```sh
# from the repo root
bun install

# 1. Run a key:  Notara → Settings → API keys  (format: ntr_...)
# 2. Find your workspace id:
NOTARA_API_KEY=ntr_xxx bun packages/cli/src/main.ts workspaces list

# 3. Export defaults so you don't repeat them
export NOTARA_URL=http://localhost:3000      # default
export NOTARA_API_KEY=ntr_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
export NOTARA_WORKSPACE=<workspace-id>
```

Each setting can be a flag (`--url`, `--token`/`-t`, `--workspace`/`-w`) or an env var (`NOTARA_URL`, `NOTARA_API_KEY`, `NOTARA_WORKSPACE`); the flag wins.

## Commands

```
notara workspaces list                          # works without a workspace selected
notara config                                   # show resolved settings

notara pages list
notara pages get <pageId>
notara pages create --title "Notes" [--parent <pageId>]
notara pages update <pageId> [--title ...] [--icon 📝] [--favorite]
notara pages delete <pageId> [--permanent]
notara pages restore <pageId>

notara blocks list <pageId>
notara blocks create <pageId> --type paragraph --content "<p>Hello</p>" [--index 0]
notara blocks update <blockId> --content "<p>Edited</p>"
notara blocks delete <blockId>

notara databases list
notara databases create --page <pageId> --name "Tasks"
notara databases update <dbId> [--name ...] [--title-label ...] [--title-hidden|--no-title-hidden]
notara databases delete <dbId> [--permanent]
notara databases restore <dbId>
notara databases fields <dbId>
notara databases add-field <dbId> --name "Status" --type select --options "Todo,Doing,Done"
notara databases update-field <dbId> <fieldId> [--name ...] [--type ...] [--options ...]
notara databases delete-field <dbId> <fieldId>
notara databases records <dbId>
notara databases add-record <dbId> --title "Ship CLI"
notara databases update-record <dbId> <recordId> [--title ...] [--description ...]
notara databases delete-record <dbId> <recordId> [--permanent]
notara databases restore-record <dbId> <recordId>
notara databases set <dbId> <recordId> <fieldId> --value "Doing"

notara trash list                               # deleted pages/databases/records

notara search "<query>"
```

Run `notara <command> --help` for full per-command help.

### Block content formats

`--content` is passed through verbatim. The expected shape depends on `--type`:

- **Text blocks** (`paragraph`, `heading1`–`heading3`, `bulletList`, `numberedList`, `todo`, `code`, `blockquote`, `callout`, `toggle`): TipTap **HTML**, e.g. `<p>Hello <strong>world</strong></p>`.
- **`image` / `pdf`**: JSON string `{"src":"...","fileName":"..."}`.
- **`pageLink`**: the target page id. **`database`**: the target database id.
- **`divider`**: empty.

### Database cell values (`databases set`)

`--value` is stored as text and parsed on read according to the field type:

- **number**: `--value "42"` · **checkbox**: `--value "true"` / `"false"`
- **select**: `--value "Done"` (one of the field's options)
- **multiSelect**: a JSON array string, e.g. `--value '["a","b"]'`
- **text / date / relation / page**: the raw string

### Trash & permanent deletion

Deleting a page, database, or record moves it to the **trash** (soft delete) — it disappears from listings but can be restored. A server-side sweep permanently removes trashed items after a retention window (default 30 days, configurable via `trashRetentionDays` / `TRASH_RETENTION_DAYS`). Deleting a page also hides its databases.

- `notara trash list` — see what's recoverable, with `deletedAt` timestamps.
- `notara pages restore <id>` / `databases restore <id>` / `databases restore-record <dbId> <recordId>` — bring an item back.
- Add `--permanent` to any delete to skip the trash and hard-delete immediately (irreversible; cascades to children).

## Scripting / LLM use

Add `--json` to get raw API JSON on stdout (errors go to stderr prefixed with `✖`, exit code 1):

```sh
notara pages list --json | jq '.[].title'
```
