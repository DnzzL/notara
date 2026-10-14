# Triage Labels

The skills speak in terms of five canonical triage roles. In this repo, triage state is the
**Status** field of a card in Notara — the roles are its option words, so the mapping is an
identity. There are no triage *labels*: labels are reserved for issue type (`bug`,
`enhancement`).

| Canonical role    | Notara Status      | Meaning                                    | Set by |
| ----------------- | ------------------ | ------------------------------------------ | ------ |
| `needs-triage`    | `needs-triage`     | Maintainer needs to evaluate this card     | a person, in Notara's board |
| `needs-info`      | `needs-info`       | Waiting on the reporter for more           | a person, in Notara's board |
| `ready-for-agent` | `ready-for-agent`  | Fully specified, ready for an AFK agent    | a person, in the board — and where `herdr-docket task create` lands |
| `ready-for-human` | `ready-for-human`  | Requires a human decision / implementation | a person, in Notara's board |
| `wontfix`         | `wontfix`          | Will not be actioned                       | a person, in Notara's board |
| `done`            | `done`             | Terminal                                   | `herdr-docket task done`, or the board |

Notes:

- **The runner has verbs for the queue, not for triage.** `herdr-docket` can `done`, `fail`,
  `block` and `verdict` a card, but it cannot file one at `needs-triage` or park one at
  `ready-for-human` — those are a human's call, made where the human works: Notara's board.
  A skill that wants to triage a card says so in a note (`task note`) or files it and lets a
  person move it.
- **The fleet reads exactly one word: `ready-for-agent`** (the runner's `todo:` in
  `fleet.yaml`). Every other status is invisible to it, which is what makes `needs-triage` a
  real parking space rather than a race.
- `in-progress`, `failed` and `blocked` are the fleet's own lifecycle words, not triage
  roles. The runner writes them; the board shows them.
- The status list is the `options` of the queue database's `Status` field. Adding a word there
  is a field edit in the board; adding one the *fleet* must read is a `fleet.yaml` change too.
