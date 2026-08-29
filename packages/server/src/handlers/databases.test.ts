import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
} from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { SqliteClient } from "@effect/sql-sqlite-bun";
import { Effect } from "effect";
import { SqlClient } from "effect/unstable/sql";
import * as Databases from "./databases.js";

const testDbPath = path.join(os.tmpdir(), `test-databases-${Date.now()}.db`);
const TestSqlite = SqliteClient.layer({ filename: testDbPath });

const setupDB = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;
	yield* sql`
    CREATE TABLE pages (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL DEFAULT '',
      parent_id TEXT REFERENCES pages(id),
      icon TEXT,
      cover_url TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_deleted INTEGER NOT NULL DEFAULT 0,
      is_favorite INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      deleted_at TEXT
    )
  `;
	yield* sql`
    CREATE TABLE databases (
      id TEXT PRIMARY KEY,
      page_id TEXT NOT NULL REFERENCES pages(id),
      name TEXT NOT NULL DEFAULT '',
      is_deleted INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      title_label TEXT NOT NULL DEFAULT 'Name',
      title_hidden INTEGER NOT NULL DEFAULT 0,
      deleted_at TEXT
    )
  `;
	yield* sql`
    CREATE TABLE database_records (
      id TEXT PRIMARY KEY,
      database_id TEXT NOT NULL REFERENCES databases(id),
      title TEXT NOT NULL DEFAULT '',
      description TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_deleted INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      deleted_at TEXT,
      page_id TEXT REFERENCES pages(id)
    )
  `;
	yield* sql`
    CREATE TABLE database_fields (
      id TEXT PRIMARY KEY,
      database_id TEXT NOT NULL REFERENCES databases(id),
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'text',
      options TEXT,
      relation_target_db_id TEXT,
      formula TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0
    )
  `;
	yield* sql`
    CREATE TABLE record_field_values (
      id TEXT PRIMARY KEY,
      record_id TEXT NOT NULL REFERENCES database_records(id),
      field_id TEXT NOT NULL REFERENCES database_fields(id),
      value TEXT
    )
  `;
	yield* sql`
    CREATE TABLE blocks (
      id TEXT PRIMARY KEY,
      page_id TEXT NOT NULL REFERENCES pages(id),
      type TEXT NOT NULL DEFAULT 'paragraph',
      content TEXT NOT NULL DEFAULT ''
    )
  `;
	yield* sql`
    CREATE TABLE database_views (
      id TEXT PRIMARY KEY,
      database_id TEXT NOT NULL REFERENCES databases(id),
      name TEXT NOT NULL DEFAULT '',
      type TEXT NOT NULL DEFAULT 'table',
      group_by_field_id TEXT,
      sort_field_id TEXT,
      sort_order TEXT NOT NULL DEFAULT 'asc',
      config TEXT NOT NULL DEFAULT '{}',
      is_default INTEGER NOT NULL DEFAULT 0
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

function testRun<A>(
	eff: Effect.Effect<A, unknown, SqlClient.SqlClient>,
): Promise<A> {
	return Effect.runPromise(eff.pipe(Effect.provide(TestSqlite)));
}

async function seed() {
	await testRun(
		Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient;
			yield* sql`DELETE FROM record_field_values`;
			yield* sql`DELETE FROM blocks`;
			yield* sql`DELETE FROM database_views`;
			yield* sql`DELETE FROM database_records`;
			yield* sql`DELETE FROM database_fields`;
			yield* sql`DELETE FROM databases`;
			yield* sql`DELETE FROM pages`;
			yield* sql`INSERT INTO pages (id, title) VALUES ('host-page', 'Host Page')`;
			yield* sql`INSERT INTO databases (id, page_id, name) VALUES ('db1', 'host-page', 'My DB')`;
			yield* sql`INSERT INTO database_records (id, database_id, title, created_at) VALUES ('rec1', 'db1', 'Task Alpha', datetime('now'))`;
		}),
	);
}

describe("openRecordAsPage", () => {
	beforeEach(seed);

	it("creates a page and returns its id", async () => {
		const result = await testRun(Databases.openRecordAsPage("rec1"));
		expect(result.pageId).toBeTypeOf("string");
		expect(result.pageId.length).toBeGreaterThan(0);

		// The page must exist in the pages table
		const page = await testRun(
			Effect.gen(function* () {
				const sql = yield* SqlClient.SqlClient;
				const rows =
					yield* sql`SELECT id, title, parent_id FROM pages WHERE id = ${result.pageId}`;
				return rows[0] as any;
			}),
		);
		expect(page).toBeDefined();
		expect(page.title).toBe("Task Alpha");
		expect(page.parent_id).toBe("host-page");
	});

	it("stores page_id on the record", async () => {
		const { pageId } = await testRun(Databases.openRecordAsPage("rec1"));

		const records = await testRun(Databases.listRecordsWithValues("db1"));
		const rec = records.find((r) => r.record.id === "rec1");
		expect(rec?.record.pageId).toBe(pageId);
	});

	it("is idempotent — returns the same pageId on second call", async () => {
		const first = await testRun(Databases.openRecordAsPage("rec1"));
		const second = await testRun(Databases.openRecordAsPage("rec1"));
		expect(second.pageId).toBe(first.pageId);
	});
});

describe("listRecordsWithValues", () => {
	beforeEach(seed);

	it("returns pageId as null for records without an associated page", async () => {
		const records = await testRun(Databases.listRecordsWithValues("db1"));
		expect(records[0].record.pageId).toBeNull();
	});
});

const pageDeletedFlag = (pageId: string) =>
	testRun(
		Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient;
			const rows =
				yield* sql`SELECT is_deleted as "isDeleted" FROM pages WHERE id = ${pageId}`;
			return (rows[0] as { isDeleted: number } | undefined)?.isDeleted;
		}),
	);

const rowCount = (table: string, where: string) =>
	testRun(
		Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient;
			const rows = yield* sql.unsafe(
				`SELECT COUNT(*) as cnt FROM ${table} WHERE ${where}`,
			);
			return Number((rows[0] as { cnt: number }).cnt);
		}),
	);

describe("record↔page linkage on delete/restore/purge", () => {
	beforeEach(seed);

	it("deleteRecord soft-deletes the backing page", async () => {
		const { pageId } = await testRun(Databases.openRecordAsPage("rec1"));
		await testRun(Databases.deleteRecord("rec1"));
		expect(await pageDeletedFlag(pageId)).toBe(1);
	});

	it("restoreRecord restores the backing page", async () => {
		const { pageId } = await testRun(Databases.openRecordAsPage("rec1"));
		await testRun(Databases.deleteRecord("rec1"));
		await testRun(Databases.restoreRecord("rec1"));
		expect(await pageDeletedFlag(pageId)).toBe(0);
	});

	it("purgeRecord removes the backing page and its blocks", async () => {
		const { pageId } = await testRun(Databases.openRecordAsPage("rec1"));
		await testRun(
			Effect.gen(function* () {
				const sql = yield* SqlClient.SqlClient;
				yield* sql`INSERT INTO blocks (id, page_id, content) VALUES ('blk1', ${pageId}, 'hi')`;
			}),
		);
		await testRun(Databases.purgeRecord("rec1"));
		expect(await rowCount("pages", `id = '${pageId}'`)).toBe(0);
		expect(await rowCount("blocks", `page_id = '${pageId}'`)).toBe(0);
	});

	it("purgeDatabase removes its records' backing pages", async () => {
		const { pageId } = await testRun(Databases.openRecordAsPage("rec1"));
		await testRun(Databases.purgeDatabase("db1"));
		expect(await rowCount("pages", `id = '${pageId}'`)).toBe(0);
	});

	it("purgePage removes backing pages of its contained records", async () => {
		const { pageId } = await testRun(Databases.openRecordAsPage("rec1"));
		await testRun(Databases.purgePage("host-page"));
		expect(await rowCount("pages", `id = '${pageId}'`)).toBe(0);
		expect(await rowCount("pages", `id = 'host-page'`)).toBe(0);
	});
});

describe("trash listing, restore, and purge sweep", () => {
	beforeEach(seed);

	it("restoreDatabase untrashes a soft-deleted database", async () => {
		await testRun(Databases.deleteDatabase("db1"));
		const res = await testRun(Databases.restoreDatabase("db1"));
		expect(res.restored).toBe(true);
		expect(await rowCount("databases", "id = 'db1' AND is_deleted = 0")).toBe(
			1,
		);
	});

	it("listTrash groups trashed pages, databases, and records", async () => {
		await testRun(Databases.deleteDatabase("db1"));
		await testRun(Databases.deleteRecord("rec1"));
		await testRun(
			Effect.gen(function* () {
				const sql = yield* SqlClient.SqlClient;
				yield* sql`UPDATE pages SET is_deleted = 1, deleted_at = datetime('now') WHERE id = 'host-page'`;
			}),
		);
		const trash = await testRun(Databases.listTrash);
		expect(trash.databases.map((d) => d.id)).toContain("db1");
		expect(trash.records.map((r) => r.id)).toContain("rec1");
		expect(trash.pages.map((p) => p.id)).toContain("host-page");
	});

	it("purgeExpired removes items past the retention window but keeps recent ones", async () => {
		await testRun(
			Effect.gen(function* () {
				const sql = yield* SqlClient.SqlClient;
				yield* sql`UPDATE database_records SET is_deleted = 1, deleted_at = '2000-01-01 00:00:00' WHERE id = 'rec1'`;
				yield* sql`INSERT INTO database_records (id, database_id, title, is_deleted, deleted_at, created_at)
                 VALUES ('rec2', 'db1', 'Recent', 1, datetime('now'), datetime('now'))`;
			}),
		);
		await testRun(Databases.purgeExpired(30));
		expect(await rowCount("database_records", "id = 'rec1'")).toBe(0);
		expect(await rowCount("database_records", "id = 'rec2'")).toBe(1);
	});
});

describe("createDatabase — sensible default columns", () => {
	beforeEach(seed);

	it("creates a database with visible title column and a default text field", async () => {
		const db = await testRun(
			Databases.createDatabase({ pageId: "host-page", name: "My New DB" }),
		);
		expect(db.titleHidden).toBe(false);

		const fields = await testRun(Databases.listFields(db.id));
		// One extra text field (the title column is implicit — stored in record.title, not as a database_field)
		expect(fields.length).toBe(1);
		expect(fields[0].type).toBe("text");
		expect(fields[0].name).toBe("Notes");

		// Verify no relation/people/rollup columns
		const unwanted = fields.filter(
			(f) => f.type === "relation" || f.type === "people",
		);
		expect(unwanted.length).toBe(0);
	});

	it("creates a default table view", async () => {
		const db = await testRun(
			Databases.createDatabase({ pageId: "host-page", name: "Grid DB" }),
		);

		const views = await testRun(Databases.listViews(db.id));
		expect(views.length).toBe(1);
		expect(views[0].type).toBe("table");
		expect(views[0].isDefault).toBe(true);
	});
});

describe("default view (one per database)", () => {
	beforeEach(seed);

	it("updateView setting a view default clears the previous default in the same database", async () => {
		const { a, b } = await testRun(
			Effect.gen(function* () {
				const a = yield* Databases.createView({
					databaseId: "db1",
					name: "A",
					type: "table",
					groupByFieldId: null,
					isDefault: true,
				});
				const b = yield* Databases.createView({
					databaseId: "db1",
					name: "B",
					type: "board",
					groupByFieldId: null,
				});
				return { a, b };
			}),
		);
		expect(a.isDefault).toBe(true);
		expect(b.isDefault).toBe(false);

		// Promote B — A must be demoted so exactly one default remains.
		const updated = await testRun(
			Databases.updateView({ id: b.id, isDefault: true }),
		);
		expect(updated.isDefault).toBe(true);

		const defaults = (await testRun(Databases.listViews("db1"))).filter(
			(v) => v.isDefault,
		);
		expect(defaults.map((v) => v.id)).toEqual([b.id]);
	});

	it("updateView default does not affect defaults in other databases", async () => {
		await testRun(
			Effect.gen(function* () {
				const sql = yield* SqlClient.SqlClient;
				yield* sql`INSERT INTO databases (id, page_id, name) VALUES ('db2', 'host-page', 'Other DB')`;
			}),
		);
		const { other, b } = await testRun(
			Effect.gen(function* () {
				yield* Databases.createView({
					databaseId: "db1",
					name: "A",
					type: "table",
					groupByFieldId: null,
					isDefault: true,
				});
				const other = yield* Databases.createView({
					databaseId: "db2",
					name: "C",
					type: "table",
					groupByFieldId: null,
					isDefault: true,
				});
				const b = yield* Databases.createView({
					databaseId: "db1",
					name: "B",
					type: "table",
					groupByFieldId: null,
				});
				return { other, b };
			}),
		);

		await testRun(Databases.updateView({ id: b.id, isDefault: true }));

		const db1Defaults = (await testRun(Databases.listViews("db1"))).filter(
			(v) => v.isDefault,
		);
		const db2Defaults = (await testRun(Databases.listViews("db2"))).filter(
			(v) => v.isDefault,
		);
		expect(db1Defaults.map((v) => v.id)).toEqual([b.id]);
		expect(db2Defaults.map((v) => v.id)).toEqual([other.id]);
	});
});
