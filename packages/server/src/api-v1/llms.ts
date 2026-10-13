/**
 * `/llms.txt`: how an agent works a card on this instance, in one read
 * (llmstxt.org). Every call in it is checked against the route table by
 * test/llms-txt.test.ts.
 */
export const llmsTxt = `# Notara

> Notes, docs and a backlog shared by a team and its agents. A card is a record of a database; its acceptance criteria are the to-dos of its page; the conversation about it is its comment thread. Whatever runs the agents claims cards and routes them: Notara stores them and serves the people.

Every call takes \`Authorization: Bearer ntr_…\` (a key from the sidebar → API keys; a read key only reads). Paths below are relative to \`/api/v1/workspaces/<workspaceId>\`; list your workspaces with \`GET /api/v1/workspaces\`. A card is named by its id or its short id (\`NOT-12\`). Errors are \`{"error": "…"}\` with a 4xx status that says what to fix.

## A card's cycle

1. Find work: \`GET /databases/<dbId>/records?field=Status&value=ready-for-agent\` — repeat \`field\`/\`value\` pairs to AND them; fields by name or id.
2. Read the card: \`GET /databases/<dbId>/records/NOT-12\` → \`fields\`, \`body\` (its page as markdown), \`criteria\` (\`[{id, text, checked}]\`).
3. Read and write its thread: \`GET /databases/<dbId>/records/NOT-12/comments\`, \`POST /databases/<dbId>/records/NOT-12/comments\` with \`{"body": "@ann which locale?"}\`. Markdown; \`@handle\` notifies a member.
4. Tick a criterion: \`PUT /databases/<dbId>/records/NOT-12/criteria/<criterionId>\` with \`{"checked": true}\`.
5. Move, assign or close it: \`PATCH /databases/<dbId>/records/NOT-12\` with \`{"fields": {"Status": "done"}}\`. Every value is checked against its field first; a 422 names the one that is wrong and nothing is written.
6. File follow-up work: \`POST /databases/<dbId>/records\` with \`{"title": "…", "fields": {"Status": "needs-triage"}, "body": "markdown", "criteria": ["…"]}\`.

To learn a database's fields and their options: \`GET /databases/<dbId>/fields\`.

## Artifacts

An HTML report or dashboard attached to a card runs isolated: no network, no access to the page around it. Make it self-contained — scripts, styles, fonts and images inline. A library loaded from a CDN will not load.

## More

- [OpenAPI document](/api/v1/openapi.json): every route, with its schemas
- [Interactive API docs](/api/docs)
- [Shared backlog for humans and agents](https://github.com/dnzzl/notara/blob/main/docs/shared-backlog.md): the model behind the calls
`;
