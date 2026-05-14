import { Effect } from "effect";
import { SqlClient } from "@effect/sql";
import { Page } from "@notion-alt/shared";
import { ulid } from "ulidx";

const pageFromRow = (r: any): Page => ({
  ...r,
  isDeleted: r.isDeleted === 1,
  createdAt: new Date(r.createdAt).toISOString(),
  updatedAt: new Date(r.updatedAt).toISOString(),
});

export const listPages = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const rows = yield* sql`
    SELECT id, title, parent_id as "parentId", icon,
           cover_url as "coverUrl",
           is_deleted as "isDeleted",
           created_at as "createdAt", updated_at as "updatedAt"
    FROM pages WHERE is_deleted = 0
    ORDER BY updated_at DESC
  `;
  return rows.map(pageFromRow);
});

export const getPage = (id: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const rows = yield* sql`
      SELECT id, title, parent_id as "parentId", icon,
             cover_url as "coverUrl",
             is_deleted as "isDeleted",
             created_at as "createdAt", updated_at as "updatedAt"
      FROM pages WHERE id = ${id} AND is_deleted = 0
    `;
    if (rows.length === 0) return yield* Effect.fail(new Error(`Page ${id} not found`));
    return pageFromRow(rows[0]);
  });

export const createPage = (req: { title: string; parentId: string | null }) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const id = ulid();
    const now = new Date().toISOString();
    const rows = yield* sql`
      INSERT INTO pages (id, title, parent_id, created_at, updated_at)
      VALUES (${id}, ${req.title}, ${req.parentId}, ${now}, ${now})
      RETURNING id, title, parent_id as "parentId", icon,
                cover_url as "coverUrl",
                is_deleted as "isDeleted",
                created_at as "createdAt", updated_at as "updatedAt"
    `;
    return pageFromRow(rows[0]);
  });

export const updatePage = (req: { id: string; title: string }) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const now = new Date().toISOString();
    const rows = yield* sql`
      UPDATE pages SET title = ${req.title}, updated_at = ${now}
      WHERE id = ${req.id} AND is_deleted = 0
      RETURNING id, title, parent_id as "parentId", icon,
                cover_url as "coverUrl",
                is_deleted as "isDeleted",
                created_at as "createdAt", updated_at as "updatedAt"
    `;
    if (rows.length === 0) return yield* Effect.fail(new Error(`Page ${req.id} not found`));
    return pageFromRow(rows[0]);
  });

export const deletePage = (id: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const now = new Date().toISOString();
    yield* sql`UPDATE pages SET is_deleted = 1, updated_at = ${now} WHERE id = ${id}`;
  });

export const searchPages = (query: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const rows = yield* sql`
      SELECT p.id, p.title, p.parent_id as "parentId", p.icon,
             p.cover_url as "coverUrl",
             p.is_deleted as "isDeleted",
             p.created_at as "createdAt", p.updated_at as "updatedAt"
      FROM pages p
      JOIN pages_fts fts ON fts.rowid = p.rowid
      WHERE pages_fts MATCH ${query} AND p.is_deleted = 0
      ORDER BY fts.rank
      LIMIT 50
    `;
    return rows.map(pageFromRow);
  });

/**
 * Get all descendants of a page (recursive).
 * Returns an array of page IDs that are children, grandchildren, etc.
 */
const getDescendants = (pageId: string): Effect.Effect<Set<string>> =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const descendants = new Set<string>();
    let currentLevel = [pageId];

    while (currentLevel.length > 0) {
      const rows = yield* sql`
        SELECT id FROM pages
        WHERE parent_id IN (${sql(currentLevel)}) AND is_deleted = 0
      `;
      for (const row of rows) {
        if (!descendants.has(row.id)) {
          descendants.add(row.id);
          currentLevel = [...currentLevel, row.id];
        }
      }
      // Remove processed IDs to avoid infinite loops
      currentLevel = currentLevel.filter((id) => !descendants.has(id) || id === pageId);
      // Actually, we need a cleaner approach
      break; // Simplified: use recursive CTE instead
    }

    // Use recursive CTE for clean descendant lookup
    const cteRows = yield* sql`
      WITH RECURSIVE descendants AS (
        SELECT id FROM pages WHERE id = ${pageId}
        UNION ALL
        SELECT p.id FROM pages p
        INNER JOIN descendants d ON p.parent_id = d.id
        WHERE p.is_deleted = 0
      )
      SELECT id FROM descendants WHERE id != ${pageId}
    `;
    return new Set(cteRows.map((r: any) => r.id));
  });

export const movePage = (req: { id: string; parentId: string | null }) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;

    // Cannot move into self
    if (req.parentId === req.id) {
      return yield* Effect.fail(new Error("Cannot move a page into itself"));
    }

    // Cannot move into a descendant (circular reference)
    if (req.parentId) {
      const descendants = yield* getDescendants(req.id);
      if (descendants.has(req.parentId)) {
        return yield* Effect.fail(new Error("Cannot move a page into one of its descendants"));
      }
    }

    const now = new Date().toISOString();
    const rows = yield* sql`
      UPDATE pages
      SET parent_id = ${req.parentId}, updated_at = ${now}
      WHERE id = ${req.id} AND is_deleted = 0
      RETURNING id, title, parent_id as "parentId", icon,
                cover_url as "coverUrl",
                is_deleted as "isDeleted",
                created_at as "createdAt", updated_at as "updatedAt"
    `;
    if (rows.length === 0) return yield* Effect.fail(new Error(`Page ${req.id} not found`));
    return pageFromRow(rows[0]);
  });
