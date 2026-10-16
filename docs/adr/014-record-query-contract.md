# ADR-014: The Record Query Is One Contract, Evaluated Server-Side

**Status:** Accepted
**Date:** 2026-10-16
**Scope:** How a set of records is selected — filtered, searched, sorted and bounded — and
who evaluates it. Touches the REST records endpoint, the app's database table, saved views
and the shared field-type registry.

## Context

A database's records are selected in two places that do not agree.

The **app** filters, sorts and searches in the browser: `applyFilters`/`applySorts` in
`packages/app/src/lib/filterEngine.ts` implement twelve operators per field type, and the
store holds **every** record of the database (`databaseStore.ts` → `listRecordsWithValues`,
no `LIMIT`, every field value shipped to every client).

The **API** an agent uses filters on the server: `listRecordsMatching` accepts only
`field`/`value` equality, and implements it by loading every record and every field value
before comparing in memory (`packages/server/src/handlers/databases.ts`).

Three consequences, all load-bearing:

- **Nothing scales.** A ten-thousand-card database ships ten thousand rows plus all their
  field values on every open, then filters and sorts them in the browser.
- **A view is a UI object.** Saved views exist as rows (`database_views`) with a stored
  `{filters, sorts, boardHidden}` config, but no route exposes them and no query can be
  addressed by one. The agent and the human cannot read the *same* query — which is exactly
  what the product's positioning claims.
- **The two implementations drift.** `operatorsForFieldType` already carries a comment about
  a private engine that came to understand a different operator set than the registry. The
  drift is not hypothetical; it has happened once.

The product wedge — one workspace a team and its agents share — requires a view to be a
**shared artifact**: a named query both the human and the agent can be pointed at.

## Decision

- **One evaluator, in `packages/shared`.** The operator semantics move out of the app and
  live beside `fieldTypeSpec`, which already carries `operators`, `decode`, `encode` and
  `compare` for every field type. The browser query bar and the REST endpoint both call it.
  A field type's operators, decoding and comparison remain declared in one place.
- **The record query is one shape**: `{filters, sorts, q, limit, cursor}`, where a filter is
  `{field, operator, value}`.
- **A saved view is a stored instance of that query**, addressable by `view` — by name, or
  by id. Resolving a view's `fieldId`-keyed filters against a values map keyed by field name
  is the query layer's job, not a caller's.
- **Evaluation is server-side and authoritative.** The client stops deciding which records
  match; it asks. Server-side ordering is deterministic, so pagination is stable.
- **The contract is additive only.** `?field=&value=` equality keeps byte-identical
  behaviour. No `limit` returns today's bare array; passing `limit` returns
  `{records, nextCursor}`. A published CLI and scripts we do not control must not break in a
  feature release.
- **Search is part of the query, applied before pagination**, so a search cannot silently
  miss records past the first page.
- **Notara ships no views of its own.** Views are user-defined. Default views named after a
  runner's vocabulary would contradict `docs/shared-backlog.md`, which states that what a
  status *means* is the runner's configuration, not Notara's. A database template is the
  flexible form of the same convenience.
- **Views gain a nullable owner/source** (`human` vs API key), unused at first, so the
  deferred question of agents creating their own working sets needs no backfill.

## Considered options

- **Keep filtering client-side and add virtualization only.** Rejected: virtualization
  shrinks rendering, not work. The payload, the JSON parse and the client-side filter over
  every record and every field remain; and a search over the loaded window is a search that
  lies.
- **Let the server grow its own operator set for agents, beside the app's.** Rejected: it
  institutionalises the drift instead of deleting it, and doubles the surface a field type's
  semantics must be kept in step with.
- **Ship default views** (`ready-for-agent`, `needs-triage`) so the loop is visible at once.
  Rejected: Notara would be picking the vocabulary, which `docs/shared-backlog.md` refuses.
  The loop is demonstrated by a template and by documentation instead.
- **Paginate behind an envelope unconditionally.** Rejected: it breaks every existing caller
  to buy nothing. The envelope appears only when `limit` asks for it.
- **A cursor in a response header.** Rejected as the primary mechanism: a body that contains
  its own continuation reads the same in every client, and is visible in the OpenAPI schema.
- **Cursor-based pagination from the start.** Rejected for now: with a ceiling of ten
  thousand cards per database, honours `limit`/`offset` semantics well enough and is far
  easier to reason about. Revisit if a real workspace exceeds it.

## Consequences

- The app's database table must load through the server query, which changes a store that
  currently holds the whole list and mutates it optimistically. This is the riskiest part of
  the change and is sequenced last.
- `listRecordsMatching` becomes a caller of the shared evaluator; its equality behaviour and
  its error for an unknown field are preserved.
- Sorting must be defined for every field type server-side (`fieldTypeSpec.compare` already
  exists to be used) before pagination can be stable.
- A record search must reach the card's page content. `globalSearch` covers pages and blocks
  today and not records, so this is new work rather than reuse.
- The OpenAPI document and `/llms.txt` are part of the contract and change in the same
  release as the routes.
