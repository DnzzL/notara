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
