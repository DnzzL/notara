# ADR-013: Last Editor Is a Column on Pages and Blocks, Not a Versions Table

**Status:** Accepted
**Date:** 2026-11-11
**Scope:** How Notara records who made an edit (NOT-174). Not a page history.

## Context

When an agent edits pages over REST or MCP, the owner must be able to see which API key did it. No page-history table, handler or UI exists, so the ticket needed a shape first.

## Decision

**Add `updated_by`, `updated_by_key_id` and `updated_by_key_name` to `pages` and `blocks`.** Migration 023, additive, all NULL for older rows.

- `updated_by` is a user id: the person for a UI edit, the key's owner for an API edit.
- `updated_by_key_id` and `updated_by_key_name` are set only for REST/MCP edits. The name is a **snapshot** taken at write time, so renaming or revoking the key later leaves the record readable. The secret and its hash are never read into this path.
- Stamped in the page and block write handlers (`createPage`, `updatePage`, `movePage`, `createBlock`, `updateBlock`, `deleteBlock`), which RPC, REST and MCP all call; each takes an `Editor` argument, so no door can skip it. A block write also stamps its page, so the page header names whoever touched it last.
- Shown as a discreet "Edited by X" line under the page title; the Page payload carries `updatedBy` and `updatedByKeyName` (never the key id).

## Rejected: a versions table

One row per edit would give real history (who, when, what changed, restore). It also needs a write on every keystroke-sized block save, a retention policy, a diff or snapshot format, and a history UI, none of which the ticket asks for. Last-editor answers "which key touched this?" with one column write. Full history remains a possible later step; `updated_by` does not block it.

## Consequences

- Only the **last** edit is known; an earlier editor is overwritten.
- Pages and blocks written before this migration, and by paths that do not stamp (import, templates, onboarding, uploads, lazily created record pages, reorder, trash/restore), show no editor.
- A page's `updated_at` is not bumped by a block edit; only its editor columns are.
