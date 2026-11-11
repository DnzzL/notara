# ADR-015: Change Events Are an SSE Stream Generated from the Operation Table

**Status:** Accepted
**Date:** 2026-11-12
**Scope:** How agents learn that a page, block or record changed (NOT-183).

## Context

Agents poll. They should react. Notara already has one SSE channel module (`sse-channel.ts`, used by presence and view-config) and one operation table (`api-v1/operations.ts`) that REST and MCP run through.

## Decision

**`GET /api/v1/workspaces/:workspaceId/events`, server-sent events, API key or session.** One `change` event per create/update/delete of a page, block or record: `kind`, `op`, `id`, `pageId` (owner), `updatedBy` (user id, ADR-014), `workspaceId`.

- **Generated, not emitted.** An operation declares `change: { kind, op, id }` in the table; `runOperation` publishes after a successful `run`. The UI's RPC door is not in the table, so `rpc-handlers.ts` wraps, once, every RPC tag named like an operation that declares `change`. No handler calls an emit function; a new operation gets events by declaring `change`.
- **Permissions at delivery.** Each subscriber's event is checked with the page-ACL (`canAccessPage`, viewer) under its own key subtree before it is sent. A scoped key hears nothing outside its subtree (ADR-012).
- **Reuses `sseChannel`**: framing, keepalive, CORS and refusal are not redone.

## Rejected: webhooks

A webhook makes the server call out to an address the caller supplies: an SSRF surface (internal addresses, redirects, DNS rebinding), retries, a delivery queue, signing and secret storage. Notara is mono-instance and self-hosted; an open connection from the consumer needs none of that, and works behind NAT.

## Consequences

- No replay: an event missed while disconnected is gone; a reconnecting client re-reads. Add `id:` frames and `Last-Event-ID` only if that bites.
- In-process subscribers (mono-instance, like presence).
- Bun does not run the stream finalizer on disconnect (see `sse-channel.ts`): a dead subscriber stays in the set until the process restarts; sending to it is a no-op.
- A permanent purge is delivered only to subscribers who still resolve access to the removed page.
- Block, page and record writes that bypass operations and RPC (import, onboarding, reorder, database/field/view edits) emit nothing.
- A UI edit costs one extra session and membership lookup (the wrapper authenticates beside the handler).
