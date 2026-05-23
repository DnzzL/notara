import { Effect } from "effect";
import { SqlClient } from "@effect/sql";
import { Block, Backlink } from "@notion-alt/shared";
import { ulid } from "ulidx";
import { BLOCK_COLS, blockFromRow } from "../mappers.js";

export const getBlockPageId = (id: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const rows = yield* sql<{ page_id: string }>`
      SELECT page_id FROM blocks WHERE id = ${id}
    `;
    return rows[0]?.page_id ?? null;
  });

export const listBlocks = (pageId: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    return yield* sql.unsafe(
      `SELECT ${BLOCK_COLS} FROM blocks WHERE page_id = ? ORDER BY "index" ASC`,
      [pageId]
    ).pipe(Effect.map(rows => rows.map(blockFromRow)));
  });

export const createBlock = (req: {
  pageId: string; type: string; content: string;
  index: number; parentId: string | null;
}) => Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  return yield* sql.withTransaction(
    Effect.gen(function* () {
      const id = ulid();
      // Shift later blocks down so the new block lands at exactly req.index
      // without colliding.
      yield* sql`
        UPDATE blocks SET "index" = "index" + 1
        WHERE page_id = ${req.pageId} AND "index" >= ${req.index}
      `;
      const rows = yield* sql`
        INSERT INTO blocks (id, page_id, type, content, "index", parent_id)
        VALUES (${id}, ${req.pageId}, ${req.type}, ${req.content}, ${req.index}, ${req.parentId})
        RETURNING ${sql.unsafe(BLOCK_COLS)}
      `;
      return blockFromRow(rows[0]);
    }),
  );
});

export const updateBlock = (req: { id: string; content: string }) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const rows = yield* sql`
      UPDATE blocks SET content = ${req.content} WHERE id = ${req.id}
      RETURNING ${sql.unsafe(BLOCK_COLS)}
    `;
    if (rows.length === 0) return yield* Effect.fail(new Error(`Block ${req.id} not found`));
    return blockFromRow(rows[0]);
  });

export const deleteBlock = (id: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`DELETE FROM blocks WHERE id = ${id}`;
  });

export const reorderBlocks = (pageId: string, blockIds: string[]) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    return yield* sql.withTransaction(
      Effect.gen(function* () {
        for (let i = 0; i < blockIds.length; i++) {
          yield* sql`UPDATE blocks SET "index" = ${i} WHERE id = ${blockIds[i]} AND page_id = ${pageId}`;
        }
        const rows = yield* sql.unsafe(
          `SELECT ${BLOCK_COLS} FROM blocks WHERE page_id = ? ORDER BY "index" ASC`,
          [pageId]
        );
        return rows.map(blockFromRow);
      }),
    );
  });

/**
 * Get all blocks that reference a specific page (backlinks).
 */
export const getBacklinks = (pageId: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const rows = yield* sql<{ blockId: string; pageId: string; pageTitle: string; content: string }>`
      SELECT b.id as "blockId", b.page_id as "pageId", p.title as "pageTitle", b.content
      FROM blocks b
      JOIN pages p ON b.page_id = p.id
      WHERE b.content LIKE ${`%data-page-ref="${pageId}"%`}
        AND p.is_deleted = 0
    `;
    return rows.map(r => new Backlink({
      blockId: r.blockId,
      pageId: r.pageId,
      pageTitle: r.pageTitle,
      content: r.content,
    }));
  });
