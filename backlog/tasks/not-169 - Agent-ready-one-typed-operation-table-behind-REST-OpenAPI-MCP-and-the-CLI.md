---
id: NOT-169
title: 'Agent-ready: one typed operation table behind REST, OpenAPI, MCP and the CLI'
status: ready-for-agent
assignee: []
created_date: '2026-10-29 17:16'
updated_date: '2026-10-29 19:55'
labels:
  - enhancement
dependencies: []
priority: high
ordinal: 143000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Problem Statement

Notara is meant to be agent-ready: anything a person can do in a workspace, an agent or a script should be able to do too, through a CLI, a JSON control channel or an MCP server. Today only the REST API and a hand-written CLI exist, and they are held together by discipline:

- an MCP client (Claude, Cursor, any agent host) cannot use Notara at all;
- the REST operations parse their input by hand and fail with untyped errors, so a malformed call can surface as a 500 instead of a clear 422;
- the OpenAPI document is hand-written next to the routes, so an agent reading it can be told about a shape the server no longer accepts;
- nothing guarantees the CLI covers what the API offers.

## Solution

Every operation is declared once, with a typed input, a typed output, its API-key scope and the errors it can fail with. Three doors are derived from that one declaration:

- REST `/api/v1` (the JSON control channel) with an OpenAPI document generated from the declarations;
- an MCP server at `/mcp`, one tool per operation, authenticated with the same API keys;
- the CLI, a REST client that a test keeps in step with the table.

Adding or changing an operation updates REST, OpenAPI and MCP at once; a read-only key sees and runs only read operations through every door.

## User Stories

1. As an agent host user, I want to point my MCP client at my Notara instance with an API key, so that my agent can work in my workspace.
2. As an agent, I want `tools/list` to describe every operation with a JSON Schema input, so that I can call them without reading docs.
3. As an agent, I want tool names to match REST operation ids, so that what I learn from one door applies to the other.
4. As an agent holding a read key, I want to see only read tools, so that I don't plan actions I'm not allowed to take.
5. As an agent holding a read key, I want a write tool call to be refused with a clear message, even if I guess its name, so that scope is enforced, not just hidden.
6. As an agent, I want a malformed tool call to fail with a validation error naming the bad field, so that I can correct it myself.
7. As an agent, I want a missing page, database or record to fail with a not-found error, so that I can tell "wrong id" from "server broke".
8. As an agent, I want tool results to be the same JSON the REST API returns, so that one mental model covers both.
9. As an agent, I want to list, read, create, update, trash and restore pages, so that I can manage documents.
10. As an agent, I want to list, create, update and delete blocks on a page, so that I can write content.
11. As an agent, I want to list databases, their fields and records, and create, update, delete and restore them, so that I can manage structured data.
12. As an agent, I want to search the workspace, so that I can find what to work on.
13. As an agent, I want to list and restore trashed items, so that I can undo mistakes.
14. As an agent, I want the MCP server to respect page permissions exactly like the app does, so that a key never sees more than its owner.
15. As a script author, I want REST to reject a malformed body with 422 and the offending field, so that bugs show up in my script, not as 500s in the server log.
16. As a script author, I want every REST error to have one documented JSON shape, so that I handle errors in one place.
17. As a script author, I want the OpenAPI document to be generated from what the server actually runs, so that generated clients never drift.
18. As a CLI user, I want every API operation to have a CLI command, so that I can script Notara from a shell without curl.
19. As a CLI user, I want `--json` output on every command, so that I can pipe results into other tools.
20. As a self-hoster, I want MCP to need no extra service, port or third-party account, so that "one container, one SQLite file" stays true.
21. As a self-hoster, I want to revoke one API key and cut off every door it used, so that access control lives in one place.
22. As the maintainer, I want to add an operation in one place and get REST, OpenAPI and MCP for free, so that the three never disagree.
23. As the maintainer, I want the compiler to reject an operation whose implementation can fail with an undeclared error, so that error handling cannot silently regress.
24. As the maintainer, I want a parity test to fail when the OpenAPI document, the MCP tool list or the CLI drift from the table, so that drift is caught in CI, not by users.
25. As the maintainer, I want a permission check and the mutation it guards to run under one workspace-layer acquisition, so that the check and the write cannot disagree.
26. As a workspace owner, I want agent actions through MCP to show up in collaboration like any other edit, so that people see what agents changed.

## Implementation Decisions

- Builds on NOT-122 (one operation table behind RPC, REST and OpenAPI). This spec adds what that task leaves open: Schema-typed input and output, declared tagged errors, the API-key scope on each operation, the MCP door and the CLI parity check.
- **The operation seam** (agreed with the architect):

  ```ts
  interface Operation<I, O> {
    operationId: string; tag: string; summary: string
    method; path                         // REST door only
    scope: "read" | "write"              // API key read/write
    input:  Schema<I>                    // path + query + body, decoded once
    output: Schema<O>
    checkPermission?: (ctx, input: I) => Effect<void, AuthError, WorkspaceServices>
    run: (ctx, input: I) => Effect<O, NotFoundError | ValidationError | ConflictError | AuthError, WorkspaceServices>
  }
  ```

  `run` returns data, never an HTTP response. Errors are the existing shared tagged errors; `unknown` errors and `any` service requirements disappear from the seam.
- **Scope is declared, not inferred from the HTTP method.** Today scope is derived from the method; with MCP there is no method, so each operation states `read` or `write` and every door enforces it from there.
- **REST door:** decodes path, query and body into `input` once, encodes `output`, maps each tagged error to one status (NotFoundError 404, ValidationError 422, ConflictError 409, AuthError 401/403) in the single shared error shape. Anything undeclared stays a reported 500.
- **OpenAPI** is generated from the operation Schemas; the hand-written document is deleted.
- **MCP door:** served by the existing server process at `/mcp` over Streamable HTTP, built on the MCP server that ships with Effect 4 — no new dependency, so the privacy page does not change. Bearer API key, same lookup as REST. One tool per operation, named by `operationId`, input schema from `input`. `tools/list` is filtered by the key's scope; `tools/call` re-checks scope and permissions. Tool results carry the operation's encoded output as JSON.
- **CLI** stays a hand-written REST client (effect/cli). No generation; a parity test keeps it complete.
- Cookie sessions do not reach `/mcp`; it is API-key only.

## Testing Decisions

- Test through the two HTTP doors only, against the real server layer and a real SQLite workspace; never call an operation's `run` directly.
- **REST:** for a representative operation per resource (page, block, database, field, record, search, trash): valid call, malformed input → 422 with the field, unknown id → 404, read key on write → refused, no permission → refused.
- **MCP:** `initialize`, `tools/list` and `tools/call` over HTTP: read key lists only read tools; write tool call with read key is refused; malformed arguments are a validation error; a call's result equals the REST response for the same operation; a page the key's owner cannot read is not readable through MCP.
- **Parity:** OpenAPI paths and operation ids equal the table; MCP tool names under a write key equal the table's operation ids; every operation id has a CLI command.
- Prior art: `route-auth.test.ts`, `api-key-scopes.test.ts`, `route-scope.test.ts`, `api-errors.test.ts`, `openapi-parity.test.ts` (its real-registration technique extends to MCP and CLI parity).
- No unit tests of adapters, decoders or mappers on their own.

## Out of Scope

- Comments, mentions and inbox (removed with the return to a minimalist Notion; tracked separately for later re-adding).
- Any queue or backlog behaviour: claims, leases, short ids, criteria, artifacts.
- Hardening outside the operation table: RPC-only paths, SQL row decoding, env config, the SQLite foreign-key pragma.
- MCP resources, prompts, sampling or OAuth; a stdio MCP transport.
- Generating the CLI from the table.
- Frontend changes, including the Foldkit spike.

## Further Notes

- MCP is the only new public surface; it inherits every guarantee of the REST door by sharing its auth, scope and permission path. Anything that reaches `/mcp` without going through that path is a bug.
- The REST contract is a published seam the CLI (on JSR) depends on: status codes and the error shape may tighten (500 → 422/404), but existing successful responses must not change shape.
<!-- SECTION:DESCRIPTION:END -->
