/**
 * The ledger is what turns a re-import from a clone into an upsert, so these
 * tests are about identity surviving the end of a run — the property the three
 * in-memory maps it replaces could not have.
 */
import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { SqliteClient } from "@effect/sql-sqlite-bun";
import { Effect } from "effect";
import type { SqlClient } from "effect/unstable/sql";
import { fieldKey, openLedger, recordKey } from "../src/import/ledger.js";

let tmpDir: string;
let filename: string;

beforeEach(() => {
	tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "notara-ledger-"));
	filename = path.join(tmpDir, "data.db");
	const db = new Database(filename);
	const migrationsDir = path.join(
		import.meta.dirname || __dirname,
		"../migrations",
	);
	for (const file of fs
		.readdirSync(migrationsDir)
		.filter((f) => f.endsWith(".sql"))
		.sort()) {
		db.exec(fs.readFileSync(path.join(migrationsDir, file), "utf-8"));
	}
	db.close();
});

afterEach(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

const run = <A>(effect: Effect.Effect<A, never, SqlClient.SqlClient>) =>
	Effect.runPromise(
		effect.pipe(Effect.provide(SqliteClient.layer({ filename }))),
	);

describe("resolve", () => {
	test("mints an id the first time and reports it as created", async () => {
		const ledger = openLedger();
		const first = await run(ledger.resolve("page", "guid-a"));
		expect(first.created).toBe(true);
		expect(first.id).toMatch(/^[0-9A-Z]{26}$/);
	});

	test("returns the same id for the same key, within one run", async () => {
		const ledger = openLedger();
		const first = await run(ledger.resolve("page", "guid-a"));
		const again = await run(ledger.resolve("page", "guid-a"));
		expect(again.id).toBe(first.id);
		expect(again.created).toBe(false);
	});

	test("returns the same id to a LATER run — the whole point", async () => {
		// The three in-memory maps this replaces could not do this, which is why
		// re-importing cloned every database.
		const first = await run(openLedger().resolve("database", "Tasks.csv"));
		const second = await run(openLedger().resolve("database", "Tasks.csv"));
		expect(second.id).toBe(first.id);
		expect(second.created).toBe(false);
	});

	test("keeps kinds apart, so a page and a database may share a key", async () => {
		const ledger = openLedger();
		const asPage = await run(ledger.resolve("page", "same-key"));
		const asDb = await run(ledger.resolve("database", "same-key"));
		expect(asDb.id).not.toBe(asPage.id);
	});

	test("keeps sources apart, so a future importer cannot collide", async () => {
		const notion = await run(openLedger("notion").resolve("page", "k"));
		const other = await run(openLedger("obsidian").resolve("page", "k"));
		expect(other.id).not.toBe(notion.id);
	});

	test("composite keys separate same-named fields in different databases", async () => {
		const ledger = openLedger();
		const inA = await run(ledger.resolve("field", fieldKey("db-a", "Status")));
		const inB = await run(ledger.resolve("field", fieldKey("db-b", "Status")));
		expect(inB.id).not.toBe(inA.id);
	});

	test("composite keys separate same-titled records in different databases", async () => {
		const ledger = openLedger();
		const inA = await run(ledger.resolve("record", recordKey("db-a", "Todo")));
		const inB = await run(ledger.resolve("record", recordKey("db-b", "Todo")));
		expect(inB.id).not.toBe(inA.id);
	});
});

describe("scopedIds", () => {
	test("reports what this run touched, and nothing else", async () => {
		const first = openLedger();
		const a = await run(first.resolve("page", "guid-a"));
		await run(first.resolve("page", "guid-b"));

		const second = openLedger();
		const c = await run(second.resolve("page", "guid-c"));

		const secondScope = await run(second.scopedIds("page"));
		expect(secondScope).toEqual([c.id]);
		expect(secondScope).not.toContain(a.id);
	});

	test("re-touching an existing id claims it for the current run", async () => {
		// A second import of the same export must still be able to act on the
		// pages it updated, not only on ones it created.
		const first = openLedger();
		const a = await run(first.resolve("page", "guid-a"));

		const second = openLedger();
		const again = await run(second.resolve("page", "guid-a"));
		expect(again.created).toBe(false);
		expect(await run(second.scopedIds("page"))).toEqual([a.id]);

		// …and the earlier run no longer claims it.
		expect(await run(first.scopedIds("page"))).toEqual([]);
	});

	test("scopes by kind", async () => {
		const ledger = openLedger();
		const page = await run(ledger.resolve("page", "k1"));
		await run(ledger.resolve("record", recordKey("db", "r1")));
		expect(await run(ledger.scopedIds("page"))).toEqual([page.id]);
	});
});
