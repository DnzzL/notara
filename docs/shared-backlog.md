# Shared backlog for humans and agents

A Notara database can be the backlog your team and your coding agents work from together.
Notara stores the cards and serves the people; whatever runs the agents — a script, a
scheduler, an agent runner — reads and writes them over the REST API. Notara has no idea
what a run is, and does not need one: claiming a card, routing it to an agent and deciding
it is done stay with the tool that runs the agents.

## The model

- **A card is a record** of a database. Its status and its agent are ordinary `select`
  fields; what each status *means* is your tool's configuration, not Notara's.
- **A card has a short id**, `PREFIX-n` (`NOT-12`): the database's prefix and a number never
  reused. The API accepts it wherever a record id goes.
- **Acceptance criteria are the to-dos** of the card's page.
- **The conversation is the card's comment thread.** A comment written through an API key
  carries the key's name, and `@handle` mentions a member.
- **People see what concerns them in their inbox**: comments that mention them, and comments
  on cards a `people` field assigns to them. A comment written through *your* key reaches
  *your* inbox — it is your agent speaking to you.

## The API, as an agent tool uses it

Create a key in the sidebar → **API keys** (a **read** key can only read). Every call takes
`Authorization: Bearer ntr_…`; paths are relative to `/api/v1/workspaces/<workspaceId>`.
Interactive docs: `GET /api/docs`. An agent arriving cold can read `GET /llms.txt`: this cycle, in one page.

| To | Call |
|---|---|
| List the cards waiting for an agent | `GET /databases/<dbId>/records?field=Status&value=ready-for-agent` — repeat `field`/`value` pairs to AND them (`&field=Agent&value=dev`) |
| Read one card in full | `GET /databases/<dbId>/records/NOT-12` → fields, `body` (its page as markdown), `criteria` (`[{id, text, checked}]`) |
| Read its thread | `GET /databases/<dbId>/records/NOT-12/comments` |
| Ask a human, report, hand over | `POST /databases/<dbId>/records/NOT-12/comments` with `{"body": "@ann which locale?"}` |
| Move it, assign it, close it | `PATCH /databases/<dbId>/records/NOT-12` with `{"fields": {"Status": "done"}}` — fields by name or id, a value its field cannot take is refused with 422 and nothing is written |
| Add criteria to a card | `POST /databases/<dbId>/records/NOT-12/criteria` with `{"criteria": ["…"]}` — appended after the ones it has |
| Tick a criterion | `PUT /databases/<dbId>/records/NOT-12/criteria/<criterionId>` with `{"checked": true}` |
| Attach a report or dashboard | `POST /databases/<dbId>/records/NOT-12/artifacts?name=report.html` with the HTML as body; shown live in the card, isolated: no network, so everything inline (`blockedHosts` names what will not load) |
| File follow-up work | `POST /databases/<dbId>/records` with `{"title": "…", "fields": {…}, "body": "markdown", "criteria": ["…"]}`. `"shortNumber": 12` keeps a chosen number for the card's short id (`NOT-12`) — for an import, not day-to-day work; a number already used is a 409 |

```bash
curl "https://notes.example.com/api/v1/workspaces/$WS/databases/$DB/records?field=Status&value=ready-for-agent" \
  -H "Authorization: Bearer $NOTARA_KEY"
```

## Moving an existing Backlog.md project in

The REST import needs only an API key, so it runs wherever the `backlog/` directory is:

```bash
NOTARA_URL=https://notes.example.com NOTARA_API_KEY=ntr_… NOTARA_WORKSPACE=<workspaceId> \
  bun packages/server/src/import-backlog-api.ts [backlogDir]
```

Every task keeps its number, its criteria become to-dos and its comments come along.
Running it again imports only what is new — a card whose short id or title is already in
the database is skipped.

`bun packages/server/src/import-backlog.ts <workspaceId> <yourUserId> [backlogDir]` does
the same through the server's own database, for running on the host that holds `DATA_DIR`.
It needs no API key, and writes the whole project in one transaction.
