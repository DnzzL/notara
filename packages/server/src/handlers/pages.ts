import { Effect } from "effect";
import { SqlClient } from "@effect/sql";
import { Page } from "@notion-alt/shared";
import { ulid } from "ulidx";
import { pageFromRow } from "../mappers.js";

export const listPages = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const rows = yield* sql`
    SELECT id, title, parent_id as "parentId", icon,
           cover_url as "coverUrl",
           sort_order as "sortOrder",
           is_deleted as "isDeleted",
           created_at as "createdAt", updated_at as "updatedAt"
    FROM pages WHERE is_deleted = 0
    ORDER BY sort_order ASC
  `;
  return rows.map(pageFromRow);
});

export const getPage = (id: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const rows = yield* sql`
      SELECT id, title, parent_id as "parentId", icon,
             cover_url as "coverUrl",
             sort_order as "sortOrder",
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

    const siblingMaxOrder = req.parentId
      ? yield* sql`
          SELECT COALESCE(MAX(sort_order), 0) as max_order
          FROM pages WHERE parent_id = ${req.parentId} AND is_deleted = 0
        `
      : yield* sql`
          SELECT COALESCE(MAX(sort_order), 0) as max_order
          FROM pages WHERE parent_id IS NULL AND is_deleted = 0
        `;
    const sortOrder = (Number(siblingMaxOrder[0]?.max_order) || 0) + 1;

    const rows = yield* sql`
      INSERT INTO pages (id, title, parent_id, sort_order, created_at, updated_at)
      VALUES (${id}, ${req.title}, ${req.parentId}, ${sortOrder}, ${now}, ${now})
      RETURNING id, title, parent_id as "parentId", icon,
                cover_url as "coverUrl",
                sort_order as "sortOrder",
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
                sort_order as "sortOrder",
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
             p.sort_order as "sortOrder",
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

const getDescendants = (pageId: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
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
    return new Set(cteRows.map((r) => r.id as string));
  });

export const movePage = (req: { id: string; parentId: string | null }) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    if (req.parentId === req.id) return yield* Effect.fail(new Error("Cannot move a page into itself"));
    if (req.parentId) {
      const descendants = yield* getDescendants(req.id);
      if (descendants.has(req.parentId)) return yield* Effect.fail(new Error("Cannot move a page into one of its descendants"));
    }
    const now = new Date().toISOString();
    const rows = yield* sql`
      UPDATE pages SET parent_id = ${req.parentId}, updated_at = ${now}
      WHERE id = ${req.id} AND is_deleted = 0
      RETURNING id, title, parent_id as "parentId", icon,
                cover_url as "coverUrl",
                sort_order as "sortOrder",
                is_deleted as "isDeleted",
                created_at as "createdAt", updated_at as "updatedAt"
    `;
    if (rows.length === 0) return yield* Effect.fail(new Error(`Page ${req.id} not found`));
    return pageFromRow(rows[0]);
  });

export const reorderPages = (req: { parentId: string | null; pageIds: string[] }) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const parentCondition = req.parentId === null ? sql`parent_id IS NULL` : sql`parent_id = ${req.parentId}`;
    const countRow = yield* sql`
      SELECT COUNT(*) as cnt FROM pages
      WHERE id IN ${sql.in(req.pageIds)} AND ${parentCondition} AND is_deleted = 0
    `;
    if (Number(countRow[0].cnt) !== req.pageIds.length) {
      return yield* Effect.fail(new Error("One or more pages do not belong to this sibling group"));
    }
    yield* Effect.all(
      req.pageIds.map((pageId, index) =>
        sql`UPDATE pages SET sort_order = ${index + 1}, updated_at = ${new Date().toISOString()} WHERE id = ${pageId} AND ${parentCondition}`
      ),
    );
    return { reordered: true };
  });
