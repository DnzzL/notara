/**
 * Short record ids (NOT-148): a database carries a prefix unique in its
 * workspace, and each record a sequential number that is never reused, so a
 * person or a runner can name a card `NOT-12` instead of an opaque id.
 */
import { Database } from "bun:sqlite";
import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { SqliteClient } from "@effect/sql-sqlite-bun";
import { Effect } from "effect";
import type { SqlClient } from "effect/sql";
import * as Databases from "../src/handlers/databases.js";
import * as Pages from "../src/handlers/pages.js";
import * as Templates from "../src/handlers/templates.js";
import { importNotionExport } from "../src/import/notion.js";

const migrationsDir = path.join(
	import.meta.dirname || __dirname,
	"../migrations",
);
const migrationFiles = fs
	.readdirSync(migrationsDir)
	.filter((f) => f.endsWith(".sql"))
	.sort();

function applyMigrations(filename: string, files: readonly string[]) {
	const db = new Database(filename);
	try {
		for (const file of files)
			db.exec(fs.readFileSync(path.join(migrationsDir, file), "utf-8"));
	} finally {
		db.close();
	}
}

/** A throwaway workspace database, migrated, and a runner bound to it. */
function workspace(files: readonly string[] = migrationFiles) {
	const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "notara-shortid-"));
	const filename = path.join(tmpDir, "test.db");
	applyMigrations(filename, files);
	const run = <A, E>(eff: Effect.Effect<A, E, SqlClient.SqlClient>) =>
		eff.pipe(
			Effect.provide(SqliteClient.layer({ filename })),
			Effect.runPromise,
		);
	const fail = <A, E>(eff: Effect.Effect<A, E, SqlClient.SqlClient>) =>
		run(Effect.flip(eff));
	return {
		filename,
		run,
		fail,
		[Symbol.dispose]: () => fs.rmSync(tmpDir, { recursive: true, force: true }),
	};
}

const newDatabase = async (ws: ReturnType<typeof workspace>, name: string) => {
	const page = await ws.run(Pages.createPage({ title: "P", parentId: null }));
	return ws.run(Databases.createDatabase({ pageId: page.id, name }));
};

describe("database prefix", () => {
	test("a new database derives its prefix from its name", async () => {
		using ws = workspace();
		const db = await newDatabase(ws, "Tâches");
		expect(db.shortPrefix).toBe("TAC");
	});

	test("a colliding prefix gets a numeric suffix", async () => {
		using ws = workspace();
		await newDatabase(ws, "Tasks");
		const second = await newDatabase(ws, "Task list");
		expect(second.shortPrefix).toBe("TAS2");
	});

	test("a name with no usable letters falls back to DB", async () => {
		using ws = workspace();
		const db = await newDatabase(ws, "42 🚀");
		expect(db.shortPrefix).toBe("DB");
	});
});

describe("record short id", () => {
	test("records are numbered in creation order", async () => {
		using ws = workspace();
		const db = await newDatabase(ws, "Notara");
		const a = await ws.run(
			Databases.createRecord({ databaseId: db.id, title: "a" }),
		);
		const b = await ws.run(
			Databases.createRecord({ databaseId: db.id, title: "b" }),
		);
		expect([a.shortId, b.shortId]).toEqual(["NOT-1", "NOT-2"]);
	});

	test("a purged record's number is never handed out again", async () => {
		using ws = workspace();
		const db = await newDatabase(ws, "Notara");
		await ws.run(Databases.createRecord({ databaseId: db.id, title: "a" }));
		const b = await ws.run(
			Databases.createRecord({ databaseId: db.id, title: "b" }),
		);
		await ws.run(Databases.purgeRecord(b.id));
		const c = await ws.run(
			Databases.createRecord({ databaseId: db.id, title: "c" }),
		);
		expect(c.shortId).toBe("NOT-3");
	});

	test("listed and fetched records carry their short id", async () => {
		using ws = workspace();
		const db = await newDatabase(ws, "Notara");
		const a = await ws.run(
			Databases.createRecord({ databaseId: db.id, title: "a" }),
		);
		const [listed] = await ws.run(Databases.listRecordsWithValues(db.id));
		const { record } = await ws.run(Databases.getRecordWithValues(a.id));
		expect(listed.record.shortId).toBe("NOT-1");
		expect(record.shortId).toBe("NOT-1");
	});
});

describe("migration of an existing workspace", () => {
	test("existing databases and records get short ids in creation order", async () => {
		const before = migrationFiles.filter((f) => f < "021");
		using ws = workspace(before);
		const raw = new Database(ws.filename);
		raw.exec(`
      INSERT INTO pages (id, title) VALUES ('p', 'P');
      INSERT INTO databases (id, page_id, name) VALUES ('d1', 'p', 'Old'), ('d2', 'p', 'Older');
      INSERT INTO database_records (id, database_id, title, created_at) VALUES
        -- Both created_at formats the table holds, same day: r1 is the older.
        ('r2', 'd1', 'second', '2026-01-01 11:00:00'),
        ('r1', 'd1', 'first', '2026-01-01T10:00:00.000Z'),
        ('s1', 'd2', 'only', '2026-01-03');
    `);
		raw.close();
		applyMigrations(
			ws.filename,
			migrationFiles.filter((f) => f >= "021"),
		);

		const { record: first } = await ws.run(Databases.getRecordWithValues("r1"));
		const { record: second } = await ws.run(
			Databases.getRecordWithValues("r2"),
		);
		const { record: only } = await ws.run(Databases.getRecordWithValues("s1"));
		expect([first.shortId, second.shortId, only.shortId]).toEqual([
			"OLD-1",
			"OLD-2",
			"OLD2-1",
		]);
		const next = await ws.run(
			Databases.createRecord({ databaseId: "d1", title: "third" }),
		);
		expect(next.shortId).toBe("OLD-3");
	});

	test("rerunning the migration on boot changes nothing", async () => {
		using ws = workspace();
		const db = await newDatabase(ws, "Notara");
		await ws.run(Databases.createRecord({ databaseId: db.id, title: "a" }));
		expect(() =>
			applyMigrations(
				ws.filename,
				migrationFiles.filter((f) => f >= "021"),
			),
		).toThrow("duplicate column");
		const b = await ws.run(
			Databases.createRecord({ databaseId: db.id, title: "b" }),
		);
		expect(b.shortId).toBe("NOT-2");
	});
});

describe("databases created outside createDatabase", () => {
	test("a template's databases get prefixes and their records short ids", async () => {
		using ws = workspace();
		await ws.run(
			Templates.createPageFromTemplate({
				templateId: "project-tracker",
				parentId: null,
			}),
		);
		const dbs = await ws.run(Databases.listAllDatabases);
		expect(dbs.length).toBeGreaterThan(0);
		for (const db of dbs) {
			expect(db.shortPrefix).toMatch(/^[A-Z][A-Z0-9]{1,5}$/);
			for (const { record } of await ws.run(
				Databases.listRecordsWithValues(db.id),
			))
				expect(record.shortId).toStartWith(`${db.shortPrefix}-`);
		}
	});

	test("a Notion import's databases get prefixes and their records short ids", async () => {
		using ws = workspace();
		const exportDir = fs.mkdtempSync(path.join(os.tmpdir(), "notara-notion-"));
		try {
			fs.writeFileSync(
				path.join(exportDir, "Roadmap 0123456789abcdef0123456789abcdef.csv"),
				"Name,Status\nShip it,Done\n",
			);
			await ws.run(importNotionExport(exportDir));
		} finally {
			fs.rmSync(exportDir, { recursive: true, force: true });
		}
		const [db] = await ws.run(Databases.listAllDatabases);
		expect(db.shortPrefix).toBe("ROA");
		const [{ record }] = await ws.run(Databases.listRecordsWithValues(db.id));
		expect(record.shortId).toBe("ROA-1");
	});
});

describe("renaming a prefix", () => {
	test("a database's prefix can be changed, and its records follow", async () => {
		using ws = workspace();
		const db = await newDatabase(ws, "Tasks");
		const a = await ws.run(
			Databases.createRecord({ databaseId: db.id, title: "a" }),
		);
		const updated = await ws.run(
			Databases.updateDatabase({ id: db.id, shortPrefix: "not" }),
		);
		expect(updated.shortPrefix).toBe("NOT");
		const { record } = await ws.run(Databases.getRecordWithValues(a.id));
		expect(record.shortId).toBe("NOT-1");
	});

	test("a prefix another database holds is refused", async () => {
		using ws = workspace();
		await newDatabase(ws, "Notara");
		const other = await newDatabase(ws, "Tasks");
		const err = await ws.fail(
			Databases.updateDatabase({ id: other.id, shortPrefix: "NOT" }),
		);
		expect(err._tag).toBe("ConflictError");
	});

	test("a malformed prefix is refused", async () => {
		using ws = workspace();
		const db = await newDatabase(ws, "Tasks");
		for (const bad of ["", "N", "1AB", "TOOLONG", "NO-T"]) {
			const err = await ws.fail(
				Databases.updateDatabase({ id: db.id, shortPrefix: bad }),
			);
			expect(err._tag, bad).toBe("ValidationError");
		}
	});
});

describe("resolving a record reference", () => {
	test("a short id resolves to its record, whatever the case", async () => {
		using ws = workspace();
		const db = await newDatabase(ws, "Notara");
		const a = await ws.run(
			Databases.createRecord({ databaseId: db.id, title: "a" }),
		);
		expect(await ws.run(Databases.resolveRecordId(db.id, "NOT-1"))).toBe(a.id);
		expect(await ws.run(Databases.resolveRecordId(db.id, "not-1"))).toBe(a.id);
	});

	test("an id passes through untouched", async () => {
		using ws = workspace();
		const db = await newDatabase(ws, "Notara");
		const a = await ws.run(
			Databases.createRecord({ databaseId: db.id, title: "a" }),
		);
		expect(await ws.run(Databases.resolveRecordId(db.id, a.id))).toBe(a.id);
	});

	test("another database's short id is not found", async () => {
		using ws = workspace();
		const notara = await newDatabase(ws, "Notara");
		const tasks = await newDatabase(ws, "Tasks");
		await ws.run(Databases.createRecord({ databaseId: tasks.id, title: "t" }));
		const err = await ws.fail(Databases.resolveRecordId(notara.id, "TAS-1"));
		expect(err._tag).toBe("NotFoundError");
	});

	test("a short id with no record behind it is not found", async () => {
		using ws = workspace();
		const db = await newDatabase(ws, "Notara");
		const err = await ws.fail(Databases.resolveRecordId(db.id, "NOT-9"));
		expect(err._tag).toBe("NotFoundError");
	});
});
