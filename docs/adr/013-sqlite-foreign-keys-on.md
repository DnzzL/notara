# ADR-013: SQLite foreign keys are enforced

**Status:** Accepted
**Date:** 2026-11-11
**Scope:** Every SQLite connection (platform.db, workspace DBs) and the upgrade path for existing data.

## Decision

`PRAGMA foreign_keys = ON` on every connection. The pragma is per-connection and a no-op inside a
transaction, so it is set where connections are opened:

- `applyMigrations` (`platform-db.ts`): after the last migration, on the connection the caller keeps
  (platform.db, and the test DBs that reuse it).
- `makeSqliteLayer` (`db.ts`): the workspace SQL client, which owns one connection per layer.

Migrations still run with the pragma OFF (table rebuilds would otherwise cascade-delete).

Before the pragma goes on, `checkForeignKeys` runs `PRAGMA foreign_key_check` and logs one count per
violated FK (`blocks.page_id -> pages: 3`). It then deletes orphans, in one transaction, only when
the parent is gone **and** the row is unreachable: the FK is `ON DELETE CASCADE` (enforcement would
have deleted it) and no surviving row points at it. Anything else (a `SET NULL` or no-action FK, or a
survivor referencing an orphan) rolls back and throws with the counts: the operator decides.

No-action FKs (view → field, field → relation target db, record → backing page) now bite: purge and
`deleteField` null or delete those references explicitly, leaf-to-root.

## Rejected

Keep the pragma OFF and delete children by hand (status quo). The schema promises cascades that never
fire, every new hard-delete must re-derive the child list, and a forgotten child leaves orphans no one
can see or delete (NOT-141). Rejected because the one-time cost is the orphan check above.

## Consequences

- An instance with non-cascade orphans (e.g. a page whose `parent_id` points at nothing) refuses to
  boot that database until it is fixed by hand. The error names the FK and the count.
- Each boot runs one `foreign_key_check` per database: O(rows), run once per open.
