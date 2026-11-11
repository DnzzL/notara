import { Database } from "bun:sqlite";
import { expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { SqliteClient } from "@effect/sql-sqlite-bun";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import * as Templates from "../src/handlers/templates.js";

const migrationsDir = path.join(import.meta.dirname, "../migrations");

// Everything a template instantiation writes, in insertion order.
const TABLES = [
	"pages",
	"blocks",
	"databases",
	"database_fields",
	"database_views",
	"database_records",
	"record_field_values",
];

// Guards the output of every built-in template: any change to a template file
// that alters what it creates shows up as a snapshot diff. Ids and timestamps
// are random, so ids are replaced by their order of first appearance.
test("every template instantiates to the recorded pages, blocks, fields, views and records", async () => {
	const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "notara-tplsnap-"));
	const filename = path.join(tmpDir, "test.db");
	try {
		const db = new Database(filename);
		for (const f of fs
			.readdirSync(migrationsDir)
			.filter((f) => f.endsWith(".sql"))
			.sort())
			db.exec(fs.readFileSync(path.join(migrationsDir, f), "utf-8"));
		db.close();

		const out: Record<string, unknown> = {};
		await Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient;
			out.catalogue = Templates.getTemplates();
			for (const { id } of Templates.getTemplates()) {
				yield* Templates.createPageFromTemplate({
					templateId: id,
					parentId: null,
				});
				const ids = new Map<string, string>();
				const norm = (v: unknown): unknown =>
					typeof v === "string"
						? v.replace(/[0-9A-HJKMNP-TV-Z]{26}/g, (m) => {
								if (!ids.has(m)) ids.set(m, `#${ids.size}`);
								return ids.get(m) as string;
							})
						: v;
				const dump: Record<string, unknown[]> = {};
				for (const t of TABLES) {
					const rows = yield* sql.unsafe(`SELECT * FROM ${t} ORDER BY rowid`);
					dump[t] = rows.map((r) =>
						Object.fromEntries(
							Object.entries(r)
								.filter(([k]) => !k.endsWith("_at"))
								.map(([k, v]) => [k, norm(v)]),
						),
					);
					yield* sql.unsafe(`DELETE FROM ${t}`);
				}
				out[id] = dump;
			}
		}).pipe(
			Effect.provide(SqliteClient.layer({ filename })),
			Effect.runPromise,
		);
		expect(out).toMatchSnapshot();
	} finally {
		fs.rmSync(tmpDir, { recursive: true, force: true });
	}
});
