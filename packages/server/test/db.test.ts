import { describe, test, expect, afterEach } from "bun:test";
import { Effect } from "effect";
import { SqliteClient } from "@effect/sql-sqlite-bun";
import { Database } from "bun:sqlite";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

function makeTestDb() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "notion-alt-test-"));
  const filename = path.join(tmpDir, "test.db");
  return { filename, tmpDir };
}

function cleanup(tmpDir: string) {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

const TestDbLayer = (filename: string) =>
  SqliteClient.layer({ filename });

const migrationsPath = path.join(import.meta.dirname || __dirname, "../migrations/001_initial.sql");

function runMigrations(filename: string) {
  const sqlContent = fs.readFileSync(migrationsPath, "utf-8");
  // Use Bun's raw exec() for multi-statement SQL (handles triggers with BEGIN...END)
  const db = new Database(filename);
  try {
    db.exec(sqlContent);
  } finally {
    db.close();
  }
}

describe("Database Connection", () => {
  test("should connect and execute a simple query", async () => {
    const { filename, tmpDir } = makeTestDb();
    try {
      const result = await Effect.gen(function* () {
        const sql = yield* SqliteClient.SqliteClient;
        const rows = yield* sql`SELECT 1 as value`;
        return rows;
      }).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);

      expect(result).toEqual([{ value: 1 }]);
    } finally {
      cleanup(tmpDir);
    }
  });
});

describe("Migrations", () => {
  const expectedTables = [
    "pages",
    "blocks",
    "databases",
    "database_fields",
    "database_records",
    "record_field_values",
    "database_views",
    "pages_fts",
  ];

  test("should create all expected tables after running migrations", async () => {
    const { filename, tmpDir } = makeTestDb();
    try {
      await runMigrations(filename);

      const tables = await Effect.gen(function* () {
        const sql = yield* SqliteClient.SqliteClient;
        const rows = yield* sql`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`;
        return rows.map((r: any) => r.name);
      }).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);

      for (const tableName of expectedTables) {
        expect(tables).toContain(tableName);
      }
    } finally {
      cleanup(tmpDir);
    }
  });

  test("should create FTS triggers", async () => {
    const { filename, tmpDir } = makeTestDb();
    try {
      await runMigrations(filename);

      const triggers = await Effect.gen(function* () {
        const sql = yield* SqliteClient.SqliteClient;
        const rows = yield* sql`SELECT name FROM sqlite_master WHERE type='trigger' ORDER BY name`;
        return rows.map((r: any) => r.name);
      }).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);

      expect(triggers).toContain("pages_ai");
      expect(triggers).toContain("pages_ad");
    } finally {
      cleanup(tmpDir);
    }
  });
});

describe("Page table schema", () => {
  test("should have the expected columns in pages table", async () => {
    const { filename, tmpDir } = makeTestDb();
    try {
      await runMigrations(filename);

      const columns = await Effect.gen(function* () {
        const sql = yield* SqliteClient.SqliteClient;
        const rows = yield* sql`PRAGMA table_info(pages)`;
        return rows.map((r: any) => r.name);
      }).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);

      expect(columns).toContain("id");
      expect(columns).toContain("title");
      expect(columns).toContain("parent_id");
      expect(columns).toContain("icon");
      expect(columns).toContain("cover_url");
      expect(columns).toContain("is_deleted");
      expect(columns).toContain("created_at");
      expect(columns).toContain("updated_at");
    } finally {
      cleanup(tmpDir);
    }
  });

  test("should insert and read back a page", async () => {
    const { filename, tmpDir } = makeTestDb();
    try {
      await runMigrations(filename);

      const page = await Effect.gen(function* () {
        const sql = yield* SqliteClient.SqliteClient;
        yield* sql`INSERT INTO pages (id, title) VALUES ('page-1', 'Test Page')`;
        const rows = yield* sql`SELECT * FROM pages WHERE id = 'page-1'`;
        return rows[0];
      }).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);

      expect(page).toBeDefined();
      expect(page.id).toBe("page-1");
      expect(page.title).toBe("Test Page");
    } finally {
      cleanup(tmpDir);
    }
  });
});

describe("Block table with foreign key", () => {
  test("should insert a block referencing a page and read it back", async () => {
    const { filename, tmpDir } = makeTestDb();
    try {
      await runMigrations(filename);

      const block = await Effect.gen(function* () {
        const sql = yield* SqliteClient.SqliteClient;
        yield* sql`INSERT INTO pages (id, title) VALUES ('page-1', 'Test Page')`;
        yield* sql`INSERT INTO blocks (id, page_id, type, content, "index") VALUES ('block-1', 'page-1', 'paragraph', 'Hello world', 0)`;
        const rows = yield* sql`SELECT * FROM blocks WHERE id = 'block-1'`;
        return rows[0];
      }).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);

      expect(block).toBeDefined();
      expect(block.id).toBe("block-1");
      expect(block.page_id).toBe("page-1");
      expect(block.type).toBe("paragraph");
      expect(block.content).toBe("Hello world");
      expect(block.index).toBe(0);
    } finally {
      cleanup(tmpDir);
    }
  });
});

describe("Database + Field + Record relationships", () => {
  test("should support the full chain: page → database → field → record → field_value", async () => {
    const { filename, tmpDir } = makeTestDb();
    try {
      await runMigrations(filename);

      const result = await Effect.gen(function* () {
        const sql = yield* SqliteClient.SqliteClient;

        // Insert page
        yield* sql`INSERT INTO pages (id, title) VALUES ('page-1', 'My Database')`;

        // Insert database
        yield* sql`INSERT INTO databases (id, page_id, name) VALUES ('db-1', 'page-1', 'Tasks')`;

        // Insert field
        yield* sql`INSERT INTO database_fields (id, database_id, name, type) VALUES ('field-1', 'db-1', 'Status', 'select')`;

        // Insert record
        yield* sql`INSERT INTO database_records (id, database_id, title) VALUES ('rec-1', 'db-1', 'Task 1')`;

        // Insert field value
        yield* sql`INSERT INTO record_field_values (id, record_id, field_id, value) VALUES ('rfv-1', 'rec-1', 'field-1', 'done')`;

        // JOIN query to verify full chain
        const rows = yield* sql`
          SELECT 
            r.id as record_id,
            r.title as record_title,
            d.name as db_name,
            f.name as field_name,
            fv.value as field_value
          FROM database_records r
          JOIN databases d ON r.database_id = d.id
          JOIN record_field_values fv ON fv.record_id = r.id
          JOIN database_fields f ON fv.field_id = f.id
          WHERE r.id = 'rec-1'
        `;
        return rows[0];
      }).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);

      expect(result).toBeDefined();
      expect(result.record_id).toBe("rec-1");
      expect(result.record_title).toBe("Task 1");
      expect(result.db_name).toBe("Tasks");
      expect(result.field_name).toBe("Status");
      expect(result.field_value).toBe("done");
    } finally {
      cleanup(tmpDir);
    }
  });
});
