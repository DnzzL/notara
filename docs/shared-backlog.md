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
Interactive docs: `GET /api/docs`.

| To | Call |
|---|---|
| List the cards waiting for an agent | `GET /databases/<dbId>/records?field=Status&value=ready-for-agent` — repeat `field`/`value` pairs to AND them (`&field=Agent&value=dev`) |
| Read one card in full | `GET /databases/<dbId>/records/NOT-12` → fields, `body` (its page as markdown), `criteria` (`[{id, text, checked}]`) |
| Read its thread | `GET /databases/<dbId>/records/NOT-12/comments` |
| Ask a human, report, hand over | `POST /databases/<dbId>/records/NOT-12/comments` with `{"body": "@ann which locale?"}` |
| Move it, assign it, close it | `PUT /databases/<dbId>/records/NOT-12/fields/<fieldId>` with `{"value": "done"}` |
| Tick a criterion | `PUT /databases/<dbId>/records/NOT-12/criteria/<criterionId>` with `{"checked": true}` |
| File follow-up work | `POST /databases/<dbId>/records` with `{"title": "…"}`, then set its fields |

```bash
curl "https://notes.example.com/api/v1/workspaces/$WS/databases/$DB/records?field=Status&value=ready-for-agent" \
  -H "Authorization: Bearer $NOTARA_KEY"
```

## Moving an existing Backlog.md project in

`bun packages/server/src/import-backlog.ts <workspaceId> <yourUserId> [backlogDir]` imports
a Backlog.md project into a new database: every task keeps its number, its criteria become
to-dos and its comments come along. Running it again imports only what is new.
