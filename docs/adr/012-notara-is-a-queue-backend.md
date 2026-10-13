# ADR-012: Notara Is a Queue Backend; Execution Belongs to the Runner

**Status:** Accepted
**Date:** 2026-10-13
**Scope:** Product positioning and the boundary between Notara and the agents that work
from it. Spec: `specs/shared-backlog.md`.

## Context

Notara is repositioned as an AI-first Notion alternative whose databases double as a
backlog shared by humans and coding agents. Success is concrete: Notara replaces
Backlog.md as the backlog of Notara itself, worked by its author and at least two
different agents.

Running agents already has an owner outside Notara. A runner (herdr-docket today) picks
tasks, locks them, routes them by assignee, builds the prompt, records the verdict,
verifies and merges. It reads its queue through a port (`List`, `Get`, `Create`,
`Comment`, `Close`, plus optional assign / phase / criteria writes) and keeps the
mapping of status words in its own config. Any rule Notara wrote about pickup would
either duplicate that or contradict it.

## Decision

- **Notara stores, exposes, and serves the human. It knows nothing of runs.** No claim,
  no lease, no `next`, no transition rules, no agent orchestration.
- **A card is a record.** Status and agent are ordinary `select` options; their meaning
  lives in the runner's config. Acceptance criteria are the to-do blocks of the record's
  page. No new field type, no role mapping stored in Notara.
- **Agents reach Notara through the runner's adapter**, built against REST `/api/v1`.
  Agents never call Notara directly for queue work, so swapping the backend touches
  neither prompts nor skills.
- **Notara adds only what the port and the human side need**, all generic: comments on
  pages, `@handle` mentions, an inbox, a short record id (`PREFIX-n`), list filtering by
  field value, and record bodies as markdown over the API.
- **Agents are not workspace members.** The assignee is a `select` of agent names; each
  runner holds one API key; the comment's author is the key's user, shown with the key
  name.
- **Rejected:** claim/lease and transition rules inside Notara, so a raw agent could work
  it without a runner. That rebuilds the runner's lock and routing in a second place, in
  a second language, and lets the two disagree about who owns a task.
- **Rejected:** a native `Card` entity beside records. It duplicates views, ACLs and the
  board for one use of a database.
- **Rejected:** starting over from a local-files notepad (Hubble.md). It has no server,
  API, auth or multi-user model, and the queue needs all four.

## Consequences

- MCP, webhooks, atomic compare-and-set writes and email notifications are out of v1. A
  CAS would be a generic conditional field write, never a lease, and only once a runner
  spans several machines.
- The inbox cannot reason about status words. It lists mentions and records where the
  user sits in a `people` field; an agent that needs a human mentions them.
- The SQLite FK pragma is off (CLAUDE.md, Known Debt): hard-deleting a page must delete
  its comments and inbox entries explicitly.
- The runner's adapter lives in the runner's repository; Notara's REST contract becomes a
  seam another project depends on.
