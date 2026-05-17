import { Effect } from "effect";
import { SqlClient } from "@effect/sql";
import { SearchResult } from "@notion-alt/shared";

// Escape special FTS5 characters
function escapeFtsQuery(q: string): string {
  return q.replace(/["<>~*()]/g, "");
}

export const globalSearch = (query: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const safeQuery = escapeFtsQuery(query.trim());
    if (!safeQuery) return [];

    const results: SearchResult[] = [];

    // 1. Search pages by title via FTS
    const pageRows = yield* sql`
      SELECT p.id, p.title, '' as content, p.id as "pageId"
      FROM pages p
      JOIN pages_fts fts ON fts.rowid = p.rowid
      WHERE pages_fts MATCH ${safeQuery} AND p.is_deleted = 0
      ORDER BY fts.rank
      LIMIT 20
    `;
    for (const r of pageRows) {
      results.push(new SearchResult({
        type: "page", id: r.id as string,
        title: r.title as string, content: "",
        pageId: r.pageId as string,
      }));
    }

    // 2. Search blocks by content via FTS, join with pages for title
    const blockRows = yield* sql`
      SELECT b.id, p.title as "pageTitle", b.content, b.page_id as "pageId"
      FROM blocks b
      JOIN blocks_fts fts ON fts.rowid = b.rowid
      JOIN pages p ON b.page_id = p.id
      WHERE blocks_fts MATCH ${safeQuery} AND p.is_deleted = 0
      ORDER BY fts.rank
      LIMIT 30
    `;
    for (const r of blockRows) {
      results.push(new SearchResult({
        type: "block", id: r.id as string,
        title: r.pageTitle as string,
        content: (r.content as string).slice(0, 200),
        pageId: r.pageId as string,
      }));
    }

    return results;
  });
