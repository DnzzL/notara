# ADR-015: Audit Log of API-Key Writes Is an Append-Only Table in the Workspace DB

**Status:** Accepted
**Date:** 2026-11-12
**Scope:** What Notara records about writes made with an API key (NOT-187). Builds on ADR-014.

## Context

`updated_by` (ADR-014) keeps only the last editor of a page or block. Owners also need to see everything a key did, which needs its own store.

## Decision

- **Storage:** table `audit_log` in each workspace DB (migration 024): `id`, `at`, `user_id`, `key_id`, `key_name` (snapshot), `operation`, `target`. Append-only: only the insert and the retention delete touch it.
- **What:** every successful **write** operation (scope `write`) run with an API key, over REST or MCP. Reads and failed calls are not logged. UI/RPC edits are not logged (they are a person, not an agent).
- **Where written:** `runOperation` (api-v1/operations.ts), the one function both REST and MCP go through, so no door can skip it.
- **No secrets, no content:** a row holds the operation id, the key's name and id, and the id of the page/block/record touched. Never the key, its hash, the request body or any page text.
- **Retention:** `AUDIT_LOG_RETENTION_DAYS`, default **90**. The daily sweep that already purges trash deletes older rows in every workspace.
- **Who reads:** workspace **owners** only, through the `listAuditLog` RPC (optionally filtered by key id, newest first, max 200) and a list in workspace settings.

## Rejected: logging in the page/block handlers

Would catch UI edits too, but means the same insert in many handlers and loses the key unless every call site passes it. One write at the operation seam covers all REST/MCP mutations.

## Consequences

- A write that fails midway leaves no row; a row exists only after the operation succeeded.
- Rows live and die with the workspace DB (backups, deletion).
- Revoking a key keeps its rows; the filter by key id still works.
- The audit insert runs after the write commits. If it fails, the caller gets an error though the write happened; a retried create then duplicates. Accepted: the insert is a plain append.
