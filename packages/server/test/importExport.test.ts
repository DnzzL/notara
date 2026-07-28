import { Database } from "bun:sqlite";
import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import { mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { SqliteClient } from "@effect/sql-sqlite-bun";
import { Effect } from "effect";
import {
	exportDatabaseAsCsv,
	exportPageAsMarkdown,
} from "../src/export/page.js";
import { importNotion } from "../src/handlers/importExport.js";

function makeTestDb() {
	const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "notara-test-"));
	const filename = path.join(tmpDir, "test.db");
	return { filename, tmpDir };
}

function cleanup(tmpDir: string) {
	fs.rmSync(tmpDir, { recursive: true, force: true });
}

const TestDbLayer = (filename: string) => SqliteClient.layer({ filename });

const _migrationsPath = path.join(
	import.meta.dirname || __dirname,
	"../migrations/001_initial.sql",
);

const allMigrationsPath = path.join(
	import.meta.dirname || __dirname,
	"../migrations",
);

function runAllMigrations(filename: string) {
	const migrationFiles = fs
		.readdirSync(allMigrationsPath)
		.filter((f) => f.endsWith(".sql"))
		.sort();
	const db = new Database(filename);
	try {
		for (const file of migrationFiles) {
			const sqlContent = fs.readFileSync(
				path.join(allMigrationsPath, file),
				"utf-8",
			);
			db.exec(sqlContent);
		}
	} finally {
		db.close();
	}
}

function seedTestData() {
	return Effect.gen(function* () {
		const sql = yield* SqliteClient.SqliteClient;

		const now = new Date().toISOString();
		yield* sql`
      INSERT INTO pages (id, title, parent_id, sort_order, is_deleted, created_at, updated_at)
      VALUES ('test-page-1', 'Test Page', NULL, 0, 0, ${now}, ${now})
    `;

		const blocks = [
			{ type: "heading1", content: "Introduction", index: 0 },
			{ type: "paragraph", content: "This is a test paragraph.", index: 1 },
			{ type: "bulletList", content: "Item one", index: 2 },
			{ type: "todo", content: "A todo item", index: 3 },
			{ type: "code", content: "console.log('hello')", index: 4 },
		];

		for (const block of blocks) {
			yield* sql`
        INSERT INTO blocks (id, page_id, type, content, "index")
        VALUES (${`block-${block.index}`}, 'test-page-1', ${block.type}, ${block.content}, ${block.index})
      `;
		}

		yield* sql`
      INSERT INTO databases (id, page_id, name, sort_order, is_deleted)
      VALUES ('test-db-1', 'test-page-1', 'Test Database', 0, 0)
    `;

		const fields = [
			{ name: "Status", type: "select" },
			{ name: "Priority", type: "text" },
		];
		for (const field of fields) {
			yield* sql`
        INSERT INTO database_fields (id, database_id, name, type)
        VALUES (${`field-${field.name.toLowerCase()}`}, 'test-db-1', ${field.name}, ${field.type})
      `;
		}

		yield* sql`
      INSERT INTO database_records (id, database_id, title, sort_order, is_deleted, created_at)
      VALUES ('record-1', 'test-db-1', 'Task One', 0, 0, ${now})
    `;
		yield* sql`
      INSERT INTO database_records (id, database_id, title, sort_order, is_deleted, created_at)
      VALUES ('record-2', 'test-db-1', 'Task Two', 1, 0, ${now})
    `;

		yield* sql`
      INSERT INTO record_field_values (id, record_id, field_id, value)
      VALUES ('fv-1', 'record-1', 'field-status', 'Done')
    `;
		yield* sql`
      INSERT INTO record_field_values (id, record_id, field_id, value)
      VALUES ('fv-2', 'record-1', 'field-priority', 'High')
    `;
		yield* sql`
      INSERT INTO record_field_values (id, record_id, field_id, value)
      VALUES ('fv-3', 'record-2', 'field-status', 'In Progress')
    `;
		yield* sql`
      INSERT INTO record_field_values (id, record_id, field_id, value)
      VALUES ('fv-4', 'record-2', 'field-priority', 'Medium')
    `;
	});
}

describe("exportPageAsMarkdown", () => {
	test("generates markdown with title and blocks", async () => {
		const { filename, tmpDir } = makeTestDb();
		try {
			runAllMigrations(filename);

			const result = await Effect.gen(function* () {
				yield* seedTestData();
				return yield* exportPageAsMarkdown("test-page-1");
			}).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);

			expect(result.pageId).toBe("test-page-1");
			expect(result.title).toBe("Test Page");
			expect(result.markdown).toContain("# Test Page");
			expect(result.markdown).toContain("# Introduction");
			expect(result.markdown).toContain("This is a test paragraph.");
			expect(result.markdown).toContain("- Item one");
			expect(result.markdown).toContain("- [ ] A todo item");
			expect(result.markdown).toContain("console.log('hello')");
			expect(result.databasesExported).toBe(0);
		} finally {
			cleanup(tmpDir);
		}
	});
});

describe("exportDatabaseAsCsv", () => {
	test("generates CSV with headers and data rows", async () => {
		const { filename, tmpDir } = makeTestDb();
		try {
			runAllMigrations(filename);

			const result = await Effect.gen(function* () {
				yield* seedTestData();
				return yield* exportDatabaseAsCsv("test-db-1");
			}).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);

			expect(result.dbId).toBe("test-db-1");
			expect(result.name).toBe("Test Database");

			const lines = result.csv.split("\n");
			expect(lines.length).toBe(3);

			expect(lines[0]).toContain("Title");
			expect(lines[0]).toContain("Status");
			expect(lines[0]).toContain("Priority");

			expect(lines[1]).toContain("Task One");
			expect(lines[1]).toContain("Done");
			expect(lines[1]).toContain("High");

			expect(lines[2]).toContain("Task Two");
			expect(lines[2]).toContain("In Progress");
			expect(lines[2]).toContain("Medium");
		} finally {
			cleanup(tmpDir);
		}
	});

	test("properly escapes CSV values with commas", async () => {
		const { filename, tmpDir } = makeTestDb();
		try {
			runAllMigrations(filename);

			const result = await Effect.gen(function* () {
				const sql = yield* SqliteClient.SqliteClient;
				const now = new Date().toISOString();

				yield* sql`
          INSERT INTO pages (id, title, parent_id, sort_order, is_deleted, created_at, updated_at)
          VALUES ('test-page-2', 'CSV Escape Test', NULL, 0, 0, ${now}, ${now})
        `;
				yield* sql`
          INSERT INTO databases (id, page_id, name, sort_order, is_deleted)
          VALUES ('test-db-2', 'test-page-2', 'Escape DB', 0, 0)
        `;
				yield* sql`
          INSERT INTO database_fields (id, database_id, name, type)
          VALUES ('field-escape', 'test-db-2', 'Description', 'text')
        `;
				yield* sql`
          INSERT INTO database_records (id, database_id, title, sort_order, is_deleted, created_at)
          VALUES ('record-escape', 'test-db-2', 'Row with, comma', 0, 0, ${now})
        `;
				yield* sql`
          INSERT INTO record_field_values (id, record_id, field_id, value)
          VALUES ('fv-escape', 'record-escape', 'field-escape', 'Has "quotes" and, commas')
        `;

				return yield* exportDatabaseAsCsv("test-db-2");
			}).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);

			expect(result.csv).toContain('"Has ""quotes"" and, commas"');
		} finally {
			cleanup(tmpDir);
		}
	});
});

describe("importNotion", () => {
	test("returns ImportResult with correct counts for empty directory", async () => {
		const { filename, tmpDir } = makeTestDb();
		try {
			runAllMigrations(filename);

			const importDir = path.join(tmpDir, "notion-export");
			await mkdir(importDir, { recursive: true });

			const result = await Effect.gen(function* () {
				return yield* importNotion(importDir);
			}).pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);

			expect(result.pagesImported).toBe(0);
			expect(result.databasesImported).toBe(0);
		} finally {
			cleanup(tmpDir);
		}
	});
});
