/**
 * Two promises of the Notion importer, tested through its one entry point:
 * the counts say what was written (new vs re-imported), and a run that dies
 * half-way leaves nothing behind.
 */
import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { SqliteClient } from "@effect/sql-sqlite-bun";
import { Effect } from "effect";
import { importNotionExport } from "../src/import/notion.js";

let tmpDir: string;
let filename: string;

beforeEach(() => {
	tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "notara-import-"));
	filename = path.join(tmpDir, "data.db");
	const db = new Database(filename);
	const dir = path.join(import.meta.dirname || __dirname, "../migrations");
	for (const f of fs
		.readdirSync(dir)
		.filter((f) => f.endsWith(".sql"))
		.sort()) {
		db.exec(fs.readFileSync(path.join(dir, f), "utf-8"));
	}
	db.close();
});

afterEach(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

const write = (root: string, rel: string, content: string) => {
	const p = path.join(root, rel);
	fs.mkdirSync(path.dirname(p), { recursive: true });
	fs.writeFileSync(p, content);
};

/** Two pages and one two-row database. */
const fixtureA = () => {
	const root = path.join(tmpDir, "export-a");
	write(root, "Alpha.md", "# Alpha\n\nHello\n");
	write(root, "Beta.md", "# Beta\n\nWorld\n");
	write(root, "Tasks aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.csv", "Name\nOne\nTwo\n");
	return root;
};

/** A different export whose database holds the row the trigger rejects. */
const fixtureB = () => {
	const root = path.join(tmpDir, "export-b");
	write(root, "Gamma.md", "# Gamma\n\nPages are written first\n");
	write(root, "Bugs bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.csv", "Name\nOk\nBoom\n");
	return root;
};

const runImport = (root: string) =>
	Effect.runPromise(
		importNotionExport(root).pipe(
			Effect.provide(SqliteClient.layer({ filename })),
		),
	);

/** Everything an import can write, as comparable text. */
const snapshot = () => {
	const db = new Database(filename, { readonly: true });
	try {
		return JSON.stringify(
			[
				"pages",
				"blocks",
				"databases",
				"database_fields",
				"database_records",
				"record_field_values",
				"import_ledger",
			].map((t) => db.query(`SELECT * FROM ${t} ORDER BY 1`).all()),
		);
	} finally {
		db.close();
	}
};

describe("counts", () => {
	test("first import reports what it created, a re-import what it updated", async () => {
		const first = await runImport(fixtureA());
		expect(first.pagesUpdated).toBe(0);
		expect(first.databasesUpdated).toBe(0);
		expect(first.databasesCreated).toBe(1);
		// Alpha, Beta, plus the database's wrapper page.
		expect(first.pagesCreated).toBe(3);

		const again = await runImport(fixtureA());
		expect(again.pagesCreated).toBe(0);
		expect(again.databasesCreated).toBe(0);
		expect(again.pagesUpdated).toBe(first.pagesCreated);
		expect(again.databasesUpdated).toBe(first.databasesCreated);
	});
});

describe("rollback", () => {
	test("a failure mid-import leaves no trace and spares the earlier import", async () => {
		await runImport(fixtureA());
		const before = snapshot();

		// Fail deterministically on a row the CSV pass inserts, i.e. after the
		// page pass has already written Gamma.
		const db = new Database(filename);
		db.exec(`CREATE TRIGGER boom BEFORE INSERT ON database_records
			WHEN NEW.title = 'Boom'
			BEGIN SELECT RAISE(ABORT, 'forced failure'); END`);
		db.close();

		await expect(runImport(fixtureB())).rejects.toThrow();

		expect(snapshot()).toBe(before);
	});
});
