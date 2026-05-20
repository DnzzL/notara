import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { Effect } from "effect";
import { SqlClient } from "@effect/sql";
import { SqliteClient } from "@effect/sql-sqlite-bun";
import { Database } from "bun:sqlite";
import * as Pages from "./pages.js";
import * as path from "node:path";
import * as os from "node:os";
import * as fs from "node:fs";

const testDbPath = path.join(os.tmpdir(), `test-pages-${Date.now()}.db`);

// Create SQLite layer pointing to a temp file
const TestSqlite = SqliteClient.layer({ filename: testDbPath });

const setupDB = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  yield* sql`
    CREATE TABLE pages (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL DEFAULT '',
      parent_id TEXT REFERENCES pages(id) ON DELETE SET NULL,
      icon TEXT,
      cover_url TEXT,
      sort_order REAL NOT NULL DEFAULT 0,
      is_deleted INTEGER NOT NULL DEFAULT 0,
      is_favorite INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `;
});

beforeAll(async () => {
  await Effect.runPromise(setupDB.pipe(Effect.provide(TestSqlite)));
});

afterAll(() => {
  try {
    fs.unlinkSync(testDbPath);
  } catch {}
});

/** Helper to run an effect with the test layer */
function testRun<A>(eff: Effect.Effect<A, unknown, SqlClient.SqlClient>): Promise<A> {
  return Effect.runPromise(eff.pipe(Effect.provide(TestSqlite)));
}

describe("Pages", () => {
  describe("reorderPages", () => {
    it("reorders root-level sibling pages by sort_order", async () => {
      // Clean up
      await testRun(Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient;
        yield* sql`DELETE FROM pages`;
      }));

      // Create 3 root pages
      await testRun(Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient;
        yield* sql`INSERT INTO pages (id, title, parent_id, sort_order) VALUES ('p1', 'Page 1', NULL, 1)`;
        yield* sql`INSERT INTO pages (id, title, parent_id, sort_order) VALUES ('p2', 'Page 2', NULL, 2)`;
        yield* sql`INSERT INTO pages (id, title, parent_id, sort_order) VALUES ('p3', 'Page 3', NULL, 3)`;
      }));

      // Reorder: p3, p1, p2
      const result = await testRun(
        Pages.reorderPages({ parentId: null, pageIds: ["p3", "p1", "p2"] })
      );

      expect(result.reordered).toBe(true);

      // Verify order
      const pages = await testRun(Pages.listPages);
      expect(pages[0].id).toBe("p3");
      expect(pages[1].id).toBe("p1");
      expect(pages[2].id).toBe("p2");
    });

    it("reorders sibling pages under a specific parent without affecting others", async () => {
      // Clean up
      await testRun(Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient;
        yield* sql`DELETE FROM pages`;
      }));

      // Create 2 root pages and 3 child pages under p1
      await testRun(Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient;
        yield* sql`INSERT INTO pages (id, title, parent_id, sort_order) VALUES ('p1', 'Parent', NULL, 1)`;
        yield* sql`INSERT INTO pages (id, title, parent_id, sort_order) VALUES ('p2', 'Root 2', NULL, 2)`;
        yield* sql`INSERT INTO pages (id, title, parent_id, sort_order) VALUES ('c1', 'Child 1', 'p1', 1)`;
        yield* sql`INSERT INTO pages (id, title, parent_id, sort_order) VALUES ('c2', 'Child 2', 'p1', 2)`;
        yield* sql`INSERT INTO pages (id, title, parent_id, sort_order) VALUES ('c3', 'Child 3', 'p1', 3)`;
      }));

      // Reorder children: c3, c1, c2 under p1
      const result = await testRun(
        Pages.reorderPages({ parentId: "p1", pageIds: ["c3", "c1", "c2"] })
      );

      expect(result.reordered).toBe(true);

      // Verify root pages keep their sort_order
      const pages = await testRun(Pages.listPages);
      const p1 = pages.find((p) => p.id === "p1");
      const p2 = pages.find((p) => p.id === "p2");
      expect(p1?.sortOrder).toBe(1);
      expect(p2?.sortOrder).toBe(2);
    });
  });
});
