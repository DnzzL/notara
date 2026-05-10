import { Effect } from "effect";
import { SqlClient } from "@effect/sql";
import { Block } from "@notion-alt/shared";
import { ulid } from "ulidx";

export const listBlocks = (pageId: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    return yield* sql<Block>`
      SELECT id, page_id as "pageId", type, content,
             parent_id as "parentId", "index"
      FROM blocks WHERE page_id = ${pageId}
      ORDER BY "index" ASC
    `;
  });

export const createBlock = (req: {
  pageId: string; type: string; content: string;
  index: number; parentId: string | null;
}) => Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const id = ulid();
  const rows = yield* sql<Block>`
    INSERT INTO blocks (id, page_id, type, content, "index", parent_id)
    VALUES (${id}, ${req.pageId}, ${req.type}, ${req.content}, ${req.index}, ${req.parentId})
    RETURNING id, page_id as "pageId", type, content,
              parent_id as "parentId", "index"
  `;
  return rows[0];
});

export const updateBlock = (req: { id: string; content: string }) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const rows = yield* sql<Block>`
      UPDATE blocks SET content = ${req.content} WHERE id = ${req.id}
      RETURNING id, page_id as "pageId", type, content,
                parent_id as "parentId", "index"
    `;
    if (rows.length === 0) return yield* Effect.fail(new Error(`Block ${req.id} not found`));
    return rows[0];
  });

export const deleteBlock = (id: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`DELETE FROM blocks WHERE id = ${id}`;
  });

export const reorderBlocks = (pageId: string, blockIds: string[]) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    for (let i = 0; i < blockIds.length; i++) {
      yield* sql`UPDATE blocks SET "index" = ${i} WHERE id = ${blockIds[i]} AND page_id = ${pageId}`;
    }
    return yield* sql<Block>`
      SELECT id, page_id as "pageId", type, content,
             parent_id as "parentId", "index"
      FROM blocks WHERE page_id = ${pageId} ORDER BY "index" ASC
    `;
  });
