# Issue tracker: Notara, worked through the runner

Issues, tasks, PRDs and ideas for this repo live in a **Notara database** — the one this
project's own fleet reads. There is no GitHub Issues workflow for day-to-day work, and PRs are
not a triage surface. (GitHub Issues are used only for external bug reports via the
`bug_report.yml` template; see `CLAUDE.md` §8.)

A card is a record of that database, and its short id is `NOT-n` (`NOT-42`). Its status and
its agent are ordinary `select` fields; its acceptance criteria are the to-dos of its page;
its conversation is its comment thread.

> **The database is the store; the runner is the door.** Everything below goes through
> `herdr-docket`, which speaks Notara's REST API. The human works the same cards in Notara's
> own board and inbox. Where the queue lives — server, workspace, database — is the runner's
> `fleet.yaml`, not this repo.

## Conventions

- **Read the queue**: `herdr-docket task list` — what is waiting to be picked up.
  Add `--all` for the whole backlog, whatever its status.
- **Read one card**: `herdr-docket task view NOT-42` — body, notes and criteria.
- **Create a card**: `herdr-docket task create "<title>" -d "<body>" --ac "<criterion>"`
  (repeat `--ac`; `-a <agent>` assigns it, `-s <source>` names the queue).
- **Write a note**: `herdr-docket task note NOT-42 "<text>"`
- **Assign**: `herdr-docket task assign NOT-42 <agent>`
- **Close**: `herdr-docket task done NOT-42 [--pr <url>]`, or `fail` / `block` /
  `verdict NOT-42 PASS|FAIL --pr <url>` when a person decides.

`task create` files into the queue's pickup status — `ready-for-agent` — so the fleet may
claim the card on its next tick (~15s). To park a card for a human instead, set its Status in
Notara's board: the runner has no verb for the triage-only words.

## Triage state = status

Triage is the card's **Status** field, not labels. The five canonical roles plus `done` are
status option words; see `docs/agents/triage-labels.md` for the mapping. The fleet reads
exactly one of them.

## Pull requests as a triage surface

**No.** The tracker has no pull-request concept — requests are captured as cards. A PR is
evidence attached to a card (`task done --pr`), never a place work is filed.

## When a skill says "publish to the issue tracker"

`herdr-docket task create "<title>" -d "<body>" --ac "<criterion>"`.

## When a skill says "fetch the relevant ticket"

`herdr-docket task view <id>`.
