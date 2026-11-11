import { Database } from "bun:sqlite";
import { expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { SqliteClient } from "@effect/sql-sqlite-bun";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import * as Databases from "../src/handlers/databases.js";
import * as Templates from "../src/handlers/templates.js";

const migrationsDir = path.join(import.meta.dirname, "../migrations");

test("every template instantiates with its pages, databases, fields and views", async () => {
	const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "notara-tpl-"));
	const filename = path.join(tmpDir, "test.db");
	try {
		const db = new Database(filename);
		for (const f of fs
			.readdirSync(migrationsDir)
			.filter((f) => f.endsWith(".sql"))
			.sort())
			db.exec(fs.readFileSync(path.join(migrationsDir, f), "utf-8"));
		db.close();

		const catalogue = Templates.getTemplates().map((t) => t.id);
		for (const id of [
			"personal-crm",
			"content-calendar",
			"trip-planner",
			"reading-list",
		])
			expect(catalogue).toContain(id);

		await Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient;
			for (const tpl of Templates.TEMPLATES) {
				const page = yield* Templates.createPageFromTemplate({
					templateId: tpl.id,
					parentId: null,
				});
				expect(page.title).toBe(tpl.title);

				const children =
					yield* sql`SELECT id FROM pages WHERE parent_id = ${page.id}`;
				expect(children.length).toBe(tpl.children?.length ?? 0);

				const defs = tpl.blocks.filter((b) => b.kind === "database");
				const dbs = yield* Databases.listDatabases(page.id);
				expect(dbs.map((d) => d.name)).toEqual(defs.map((d) => d.name));

				for (const [i, def] of defs.entries()) {
					const fields =
						yield* sql`SELECT name FROM database_fields WHERE database_id = ${dbs[i].id}`;
					expect(fields.map((f) => f.name).sort()).toEqual(
						def.fields.map((f) => f.name).sort(),
					);
					const views = yield* Databases.listViews(dbs[i].id);
					expect(views.map((v) => v.name).sort()).toEqual(
						def.views.map((v) => v.name).sort(),
					);
					// Board views must be grouped by a real field.
					for (const v of views.filter((v) => v.type === "board"))
						expect(v.groupByFieldId).toBeTruthy();
					const records = yield* Databases.listRecordsWithValues(dbs[i].id);
					expect(records.length).toBe(def.records.length);
					expect(records.length).toBeGreaterThan(0);
					// Every sample cell must land: a misspelt field, relation target
					// or page title is skipped silently by the builder.
					const expected = def.records.reduce(
						(n, r) =>
							n +
							Object.keys(r.values ?? {}).length +
							Object.keys(r.relations ?? {}).length +
							Object.keys(r.pageLinks ?? {}).length,
						0,
					);
					const stored =
						yield* sql`SELECT COUNT(*) AS n FROM record_field_values WHERE record_id IN (SELECT id FROM database_records WHERE database_id = ${dbs[i].id})`;
					expect(Number(stored[0].n)).toBe(expected);
				}
			}
		}).pipe(
			Effect.provide(SqliteClient.layer({ filename })),
			Effect.runPromise,
		);
	} finally {
		fs.rmSync(tmpDir, { recursive: true, force: true });
	}
});
