# AGENTS.md

Agent guidance for this repo. The behavioural guidelines live in **`CLAUDE.md`** — read it
first. This file only says where work is tracked.

## Task protocol

Issues, ideas and bug reports live in **Notara**, in the database this project's own fleet
works. File one through the runner, never the `backlog` CLI:

```bash
herdr-docket task create "<title>" -d "<description>" --ac "<ac 1>"
```

It lands in the queue's pickup status (`ready-for-agent`), so the fleet may claim it on its
next tick. A card that should wait for a human is moved to `needs-triage` in Notara's board.

- **Read the queue**: `herdr-docket task list` (or `--all` for the whole backlog)
- **Read one card**: `herdr-docket task view NOT-42`
- **Comment / progress**: `herdr-docket task note NOT-42 "<text>"`
- **Assign**: `herdr-docket task assign NOT-42 <agent>`
- **Close**: `herdr-docket task done NOT-42 [--pr <url>]` — also `fail`, `block`, `verdict`

Triage state is a card's **Status** field: the canonical roles — `needs-triage`, `needs-info`,
`ready-for-agent`, `ready-for-human`, `wontfix` — are its option words, and the fleet reads
exactly one of them, `ready-for-agent`. The others wait for a human in the board. See
`docs/agents/issue-tracker.md` and `docs/agents/triage-labels.md`.
