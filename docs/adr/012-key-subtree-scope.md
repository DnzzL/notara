# ADR-012: An API key may be limited to a page subtree

**Status:** Accepted
**Date:** 2026-11-11
**Scope:** The key → scope seam: what a key with a root page may reach, and where that is enforced.

## Decision

`api_keys.root_page_id` (nullable). Null keeps today's meaning: whatever the owner can reach. Set, the
key reaches the root page and its descendants, and nothing else, through REST and MCP alike. It is
independent of the `read`/`write` scope (ADR-008): that says what a key may *do*, this says where.

Enforced in one place — the operation seam (`runOperation` → `withWorkspace`), which provides the root
as `KeyRoot` (`acl.ts`) for the duration of the operation:

- `acl.ts` — a first rule, authoritative like a lock: a page outside the subtree is denied, whoever
  the owner is. Every page, block, database, record, field and view check already resolves through it.
- `permissions.ts` `filterPagesByPermission` — list, search, backlinks, trash and database listings
  drop pages outside the subtree.
- `runOperation` — an operation whose input has a `parentId` places a page; the parent must be inside
  the subtree (top level is outside any subtree). Covers create, move, reorder, create-from-template.
- Workspace-wide operations (members, invites) and the instance-admin routes refuse a scoped key.

The session and RPC paths never provide `KeyRoot`, so they are unchanged.

## Consequences

- Moving a page in or out of the subtree changes access at once: the subtree is computed from
  `parent_id` on every request, never stored.
- No workspace column: page ids are ULIDs, so in another workspace the root is not an ancestor of
  anything and the key reaches nothing there.
- Creating a key with a root checks the creator can use that page at the key's own level (editor for
  `write`, viewer for `read`): a key never reaches more than its creator.
- Not covered yet: change events outside the subtree (needs NOT-183).

## Rejected

- **Per-handler checks.** Every new operation would have to remember them; NOT-102 is that failure.
- **Storing the set of reachable pages on the key.** Goes stale on every move and every new page.
- **A `workspace_id` next to the root.** Redundant given unique page ids; one more column to keep consistent.
