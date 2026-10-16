# Spec: The Shared Workspace — Notes, Artifacts and an AI-Actionable Backlog

Decision: `docs/adr/014-record-query-contract.md`. Builds on `docs/adr/012-notara-is-a-queue-backend.md`
and `docs/adr/013-artifacts-run-isolated.md`.

## Goal

Notara is the place a team and its agents work together, not a Notion clone with an API.
The wedge is the **loop**: a human writes a page, files a card with acceptance criteria, an
agent reads and ticks those criteria over the API, asks its question in the card's thread
and closes it — and the same workspace holds the notes, the cards and the HTML artifacts
that come back.

Done when a visitor to the landing page sees that loop before they see any API surface, and
a saved view is a query a human and an agent both read.

**Two workstreams.** The proof (tickets 01) ships first and carries the two-week reach test.
The query seam (02–05) makes a view a shared, scalable object. The app's table (06–07) is
gated on the reach test.

## Non-goals

Agents creating their own views · agent-writable filters · MCP server · webhooks · a new
`Card` entity · views named after a runner's vocabulary (no `ready-for-agent` default) ·
multi-tenant or cloud hosting · cursor pagination · board-view virtualization

> The existing generic `Grid` view `createDatabase` inserts so a new database renders is
> **not** in scope: it predates this work, is not run vocabulary, and stays exactly as it is.

## Tests reproduce the failure before the fix

Every ticket that changes behaviour writes the failing test first, through the seam it
changes: server-side behaviour against the REST route, app behaviour against the store or
the component that renders it. No test asserts on a private helper.

## Seams

### The record query (tickets 02–05)

One shape, evaluated server-side, behind the existing route. Every part is additive: a
caller that sends none of the new parameters gets today's response.

| Part | Shape | Serves |
|---|---|---|
| `filters` | Repeated `filter=field:operator:value`, ANDed together. `field` by id or name; `operator` from the field type's registry — the same list the query bar offers. | An agent selecting work with an operator, not only equality. |
| `view` | `view=name` or `view=id`. Case-insensitive name; an ambiguous name is a `409` naming the candidates, never a silent pick. | The human and the agent reading *the same* named query. |
| `sorts` | Repeated `sort=field:asc` or `sort=field:desc`, applied right to left. | A view's order reaching an agent, and stable pagination. |
| `q` | `q=text`. Applied **before** `limit`, over the records' field values and their page content. | Searching a large database without silently missing matches past the first page. |
| `limit` | `limit=n`, with optional `offset`. | Bounding a ten-thousand-card response. |
| Response | No `limit` gives today's bare array; `limit` gives `{records, nextCursor}`. | Not breaking a published CLI. |
| `GET /databases/:dbId/views` | The database's views: id, name, config, which is default. | An agent discovering a view name before addressing it. |

Named errors stay `{"error": "…"}` with a 4xx that says what to fix: an unknown field, an
operator a field type does not offer, an unknown view, an ambiguous view name, a `limit` the
server refuses.

### The landing proof (ticket 01)

Static marketing, no backend seam. The claim already exists in the hero
(`The AI-first Notion alternative.`); the missing half is evidence of the loop.

## Tickets

- **01 Landing: the loop, proven** (`NOT-174`) — blocked by nothing. The loop is shown, not
  claimed. Success measure is the reach test below.
- **02 One filter evaluator; the records endpoint speaks operators** (`NOT-175`) — blocked by
  nothing. The keystone; deletes the second implementation rather than adding a third.
- **03 Views over the API** (`NOT-176`) — blocked by 02. A view becomes addressable and
  therefore shared.
- **04 Pagination** (`NOT-177`) — blocked by 02. Bounds the response additively.
- **05 Search inside a query** (`NOT-178`) — blocked by 02, 04. Search runs before paging.
- **06 The app's table reads through the query** (`NOT-179`) — blocked by 04, 05. **Gated on
  the reach test.** Restructures a store that holds the whole list and mutates it
  optimistically.
- **07 The table renders long** (`NOT-180`) — blocked by 06. Row virtualization, once the list
  is bounded.

## Reach test (ticket 01's success measure)

One post — Show HN or r/selfhosted — pointing at the live demo and
`docs/shared-backlog.md`. Two weeks. Success: **3 self-hosts** and **200 demo sessions**,
measured from `get_source_clicked` and demo traffic. Ticket 06 starts only if the test
passes; if it fails, the wedge is wrong, not the copy.

## Known gaps

- No card-with-criteria screenshot exists in `docs/screenshots/`; ticket 01 ships
  transcript-only until one is produced.
- `herdr-docket`'s bare invocation reads a different queue; Notara cards need `-s notara`.
- `notara-dev` / `notara-reviewer` are paused in `fleet.yaml` with `merge: manual`.
