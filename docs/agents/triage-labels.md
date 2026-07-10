# Triage Labels

The skills speak in terms of five canonical triage roles. In this repo, triage state is
carried by the Backlog.md **status** field (not by labels), and the statuses were renamed
to map **1:1** onto the canonical roles. So the mapping is an identity.

| Canonical role    | Backlog.md status  | Meaning                                  |
| ----------------- | ------------------ | ---------------------------------------- |
| `needs-triage`    | `needs-triage`     | Maintainer needs to evaluate this task   |
| `needs-info`      | `needs-info`       | Waiting on reporter for more information |
| `ready-for-agent` | `ready-for-agent`  | Fully specified, ready for an AFK agent  |
| `ready-for-human` | `ready-for-human`  | Requires a human decision / implementation |
| `wontfix`         | `wontfix`          | Will not be actioned                     |

Apply a triage state with `backlog task edit <id> -s "<status>"`. When a skill mentions a
role (e.g. "apply the AFK-ready triage label"), set the matching status from this table.

Notes:

- `done` is a sixth, terminal status — not a triage role. Close finished work with `-s done`.
- The `bug` / `enhancement` **labels** are orthogonal to triage state; they classify the
  issue *type*, set via `-l bug,enhancement`.
- The status list is defined in `backlog/config.yml` (`statuses:`). Keep this table in sync
  if you change it.
