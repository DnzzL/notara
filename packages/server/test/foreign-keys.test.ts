import { Database } from "bun:sqlite";
import { afterEach, describe, expect, spyOn, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { makeSqliteLayer } from "../src/db.js";
import * as Databases from "../src/handlers/databases.js";
import { applyMigrations, checkForeignKeys } from "../src/platform-db.js";

const MIGRATIONS = path.join(import.meta.dir, "..", "migrations");
const dirs: string[] = [];
const tmpFile = () => {
	const d = fs.mkdtempSync(path.join(os.tmpdir(), "notara-fk-"));
	dirs.push(d);
	return path.join(d, "ws.db");
};
afterEach(() => {
	for (const d of dirs.splice(0))
		fs.rmSync(d, { recursive: true, force: true });
});

/** A migrated DB with FK enforcement still OFF, as a pre-upgrade file would be. */
const legacyDb = () => {
	const db = new Database(tmpFile());
	applyMigrations(db, MIGRATIONS);
	db.run("PRAGMA foreign_keys = OFF");
	return db;
};

describe("foreign keys are enforced", () => {
	test("ON DELETE CASCADE fires on the workspace SQL layer", async () => {
		const filename = tmpFile();
		const setup = new Database(filename);
		applyMigrations(setup, MIGRATIONS);
		setup.close();
		const left = await Effect.runPromise(
			Effect.gen(function* () {
				const sql = yield* SqlClient.SqlClient;
				yield* sql`INSERT INTO pages (id, title) VALUES ('p', 'P')`;
				yield* sql`INSERT INTO blocks (id, page_id, type) VALUES ('b', 'p', 'paragraph')`;
				yield* sql`DELETE FROM pages WHERE id = 'p'`;
				return yield* sql`SELECT id FROM blocks`;
			}).pipe(Effect.provide(makeSqliteLayer(filename))),
		);
		expect(left).toEqual([]);
	});

	test("platform.db connection has the pragma on after migrations", () => {
		const db = new Database(tmpFile());
		applyMigrations(db, path.join(MIGRATIONS, "platform"));
		expect(db.query("PRAGMA foreign_keys").get()).toEqual({ foreign_keys: 1 });
		expect(() =>
			db.run(
				`INSERT INTO "account" (id, accountId, providerId, userId, createdAt, updatedAt) VALUES ('a','x','y','nobody','t','t')`,
			),
		).toThrow(/FOREIGN KEY/);
	});
});

describe("hard-deletes under enforced foreign keys (real schema)", () => {
	const run = <A>(
		filename: string,
		eff: Effect.Effect<A, unknown, SqlClient.SqlClient>,
	) => Effect.runPromise(eff.pipe(Effect.provide(makeSqliteLayer(filename))));

	const seeded = () => {
		const filename = tmpFile();
		const setup = new Database(filename);
		applyMigrations(setup, MIGRATIONS);
		setup.run("INSERT INTO pages (id) VALUES ('host')");
		setup.run(
			"INSERT INTO databases (id, page_id, name) VALUES ('d1','host','D1')",
		);
		setup.run(
			"INSERT INTO databases (id, page_id, name) VALUES ('d2','host','D2')",
		);
		setup.run(
			"INSERT INTO database_fields (id, database_id, name, type) VALUES ('f1','d1','F1','text')",
		);
		setup.run(
			"INSERT INTO database_fields (id, database_id, name, type, relation_target_db_id) VALUES ('f2','d2','F2','relation','d1')",
		);
		setup.run(
			"INSERT INTO database_views (id, database_id, name, group_by_field_id, sort_field_id) VALUES ('v1','d1','V','f1','f1')",
		);
		setup.close();
		return filename;
	};
	const count = (filename: string, table: string) => {
		const db = new Database(filename, { readonly: true });
		const n = (db.query(`SELECT count(*) AS n FROM ${table}`).get() as any).n;
		db.close();
		return n;
	};

	test("deleteField clears views that group or sort by it", async () => {
		const f = seeded();
		await run(f, Databases.deleteField("f1"));
		expect(count(f, "database_fields")).toBe(1);
		const db = new Database(f, { readonly: true });
		expect(
			db
				.query(
					"SELECT group_by_field_id g, sort_field_id s FROM database_views",
				)
				.get(),
		).toEqual({ g: null, s: null });
		db.close();
	});

	test("purgeDatabase removes views and fields, and un-targets relations to it", async () => {
		const f = seeded();
		await run(f, Databases.purgeDatabase("d1"));
		expect(count(f, "database_views")).toBe(0);
		expect(count(f, "databases")).toBe(1);
		expect(count(f, "database_fields")).toBe(1);
	});

	test("purging a record's own page leaves the record, unlinked", async () => {
		const f = seeded();
		const setup = new Database(f);
		setup.run("INSERT INTO pages (id, parent_id) VALUES ('rp','host')");
		setup.run("INSERT INTO blocks (id, page_id, type) VALUES ('b','rp','p')");
		setup.run(
			"INSERT INTO database_records (id, database_id, page_id) VALUES ('r','d1','rp')",
		);
		setup.close();
		await run(f, Databases.purgePage("rp"));
		const db = new Database(f, { readonly: true });
		expect(db.query("SELECT page_id FROM database_records").get()).toEqual({
			page_id: null,
		});
		db.close();
		expect(count(f, "blocks")).toBe(0);
	});

	test("purgePage removes its databases, views and fields", async () => {
		const f = seeded();
		await run(f, Databases.purgePage("host"));
		for (const t of ["pages", "databases", "database_fields", "database_views"])
			expect(count(f, t)).toBe(0);
	});
});

describe("checkForeignKeys", () => {
	test("reports per-FK counts and deletes cascade orphans with their orphaned children", () => {
		const db = legacyDb();
		db.run("INSERT INTO pages (id) VALUES ('live')");
		db.run("INSERT INTO blocks (id, page_id, type) VALUES ('ok','live','p')");
		db.run("INSERT INTO blocks (id, page_id, type) VALUES ('o1','gone','p')");
		// o2 sits on a live page but under the orphan block o1: also unreachable.
		db.run(
			"INSERT INTO blocks (id, page_id, type, parent_id) VALUES ('o2','live','p','o1')",
		);
		const log = spyOn(console, "log").mockImplementation(() => {});
		checkForeignKeys(db);
		expect(log.mock.calls[0]![0]).toContain('"blocks.page_id -> pages":1');
		log.mockRestore();
		expect(db.query("SELECT id FROM blocks").all()).toEqual([{ id: "ok" }]);
	});

	test("stops and rolls back when an orphan is not a cascade child", () => {
		const db = legacyDb();
		db.run("INSERT INTO blocks (id, page_id, type) VALUES ('o1','gone','p')");
		db.run("INSERT INTO pages (id, parent_id) VALUES ('x','missing')");
		const log = spyOn(console, "log").mockImplementation(() => {});
		expect(() => checkForeignKeys(db)).toThrow(/pages\.parent_id -> pages/);
		log.mockRestore();
		expect(db.query("SELECT count(*) AS n FROM blocks").get()).toEqual({
			n: 1,
		});
	});

	test("stops when a surviving row still points at the orphan", () => {
		const db = legacyDb();
		db.run("INSERT INTO databases (id, page_id, name) VALUES ('d','gone','D')");
		db.run("INSERT INTO pages (id) VALUES ('live')");
		db.run(
			"INSERT INTO databases (id, page_id, name) VALUES ('d2','live','D2')",
		);
		db.run(
			"INSERT INTO database_fields (id, database_id, name, type, relation_target_db_id) VALUES ('f','d2','F','relation','d')",
		);
		const log = spyOn(console, "log").mockImplementation(() => {});
		expect(() => checkForeignKeys(db)).toThrow(/relation_target_db_id/);
		log.mockRestore();
		expect(
			db.query("SELECT id FROM databases WHERE id='d'").get(),
		).toBeTruthy();
	});
});
