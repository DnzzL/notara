# Issue tracker: Backlog.md

Issues, tasks, PRDs, and ideas for this repo live in **Backlog.md** — markdown task
files under `backlog/tasks/`, managed exclusively through the `backlog` CLI. There is
no GitHub Issues workflow for day-to-day work. (GitHub Issues are used only for external
bug reports via the `bug_report.yml` template; see `CLAUDE.md` §8.)

Task IDs are prefixed `NOT-` (e.g. `NOT-42`).

> **Never edit task markdown files directly.** Every read and write goes through the CLI
> so metadata, Git tracking, and relationships stay in sync. See the full Backlog.md
> reference in `AGENTS.md`.

## Conventions

- **Create a task**: `backlog task create "<title>" -s "needs-triage" --priority <low|medium|high> -l <bug|enhancement> -d "<description>" --ac "<AC 1>" --ac "<AC 2>"`
- **Read a task**: `backlog task <id> --plain` (e.g. `backlog task NOT-42 --plain`)
- **List tasks**: `backlog task list --plain`, or filter with `-s "<status>"` / `-a @who`
- **Search**: `backlog search "<topic>" --plain` (fuzzy; add `--type task`)
- **Set status**: `backlog task edit <id> -s "<status>"`
- **Assign**: `backlog task edit <id> -a @me`
- **Add labels**: `backlog task edit <id> -l bug,enhancement`
- **Comment**: `backlog task edit <id> --comment "..." --comment-author @agent`
- **Progress log**: `backlog task edit <id> --append-notes "..."`
- **PR summary**: `backlog task edit <id> --final-summary "..."`
- **Close**: `backlog task edit <id> -s done`

## Triage state = status

Triage is driven by the task **status** field, not by labels. The configured statuses in
`backlog/config.yml` are the five canonical triage roles plus a terminal `done`. See
`docs/agents/triage-labels.md` for the role↔status mapping (it's 1:1). Labels are reserved
for issue *type* (`bug` / `enhancement`).

## Pull requests as a triage surface

**PRs as a request surface: no.** Backlog.md has no pull-request concept — requests are
captured as tasks. `/triage` operates only on tasks.

## When a skill says "publish to the issue tracker"

Create a Backlog.md task: `backlog task create "<title>" -s "<triage status>" ...`.

## When a skill says "fetch the relevant ticket"

Run `backlog task <id> --plain`.
