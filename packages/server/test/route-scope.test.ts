/**
 * A route that names a database and a record or field inside it acts only when
 * that record or field is the database's: the permission check is on the
 * database, so anything else would ride on a grant for another one.
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

const migrationsDir = path.join(import.meta.dir, "../migrations");

const withDb = async <A>(
	eff: Effect.Effect<A, unknown, SqlClient.SqlClient>,
) => {
	const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "notara-scope-"));
	const filename = path.join(tmpDir, "test.db");
	const db = new Database(filename);
	for (const f of fs
		.readdirSync(migrationsDir)
		.filter((f) => f.endsWith(".sql"))
		.sort())
		db.exec(fs.readFileSync(path.join(migrationsDir, f), "utf-8"));
	db.close();
	try {
		return await Effect.runPromise(
			eff.pipe(Effect.provide(SqliteClient.layer({ filename }))),
		);
	} finally {
		fs.rmSync(tmpDir, { recursive: true, force: true });
	}
};

const twoDatabases = Effect.gen(function* () {
	const make = (name: string) =>
		Effect.gen(function* () {
			const page = yield* Pages.createPage({ title: name, parentId: null });
			const db = yield* Databases.createDatabase({ pageId: page.id, name });
			const rec = yield* Databases.createRecord({
				databaseId: db.id,
				title: "r",
			});
			const field = yield* Databases.createField({
				databaseId: db.id,
				name: "F",
				type: "text",
				options: null,
				relationTargetDbId: null,
			});
			return { db: db.id, rec: rec.id, field: field.id };
		});
	return { a: yield* make("A"), b: yield* make("B") };
});

const outcome = (eff: Effect.Effect<void, unknown, SqlClient.SqlClient>) =>
	eff.pipe(
		Effect.as("ok"),
		Effect.catch((e) =>
			Effect.succeed((e as { _tag?: string })._tag ?? "error"),
		),
	);

describe("requireInDatabase", () => {
	test("a database's own record and field pass", async () => {
		const got = await withDb(
			Effect.gen(function* () {
				const { a } = yield* twoDatabases;
				return yield* outcome(
					Databases.requireInDatabase(a.db, {
						recordId: a.rec,
						fieldId: a.field,
					}),
				);
			}),
		);
		expect(got).toBe("ok");
	});

	test("another database's record or field is not found here", async () => {
		const got = await withDb(
			Effect.gen(function* () {
				const { a, b } = yield* twoDatabases;
				return [
					yield* outcome(
						Databases.requireInDatabase(a.db, { recordId: b.rec }),
					),
					yield* outcome(
						Databases.requireInDatabase(a.db, { fieldId: b.field }),
					),
					yield* outcome(
						Databases.requireInDatabase(a.db, {
							recordId: a.rec,
							fieldId: b.field,
						}),
					),
				];
			}),
		);
		expect(got).toEqual(["NotFoundError", "NotFoundError", "NotFoundError"]);
	});

	test("a trashed record of the database still passes, so it can be restored", async () => {
		const got = await withDb(
			Effect.gen(function* () {
				const { a } = yield* twoDatabases;
				yield* Databases.deleteRecord(a.rec);
				return yield* outcome(
					Databases.requireInDatabase(a.db, { recordId: a.rec }),
				);
			}),
		);
		expect(got).toBe("ok");
	});
});
