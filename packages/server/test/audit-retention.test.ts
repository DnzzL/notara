import { afterEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { SqliteClient } from "@effect/sql-sqlite-bun";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import {
	auditRetentionDays,
	listAudit,
	purgeAudit,
	recordAudit,
} from "../src/handlers/audit.js";

const migration = readFileSync(
	join(import.meta.dir, "../migrations/024_audit_log.sql"),
	"utf8",
);

describe("audit retention", () => {
	afterEach(() => {
		delete process.env.AUDIT_LOG_RETENTION_DAYS;
	});

	test("defaults to 90 days; the env var overrides; garbage falls back", () => {
		expect(auditRetentionDays()).toBe(90);
		process.env.AUDIT_LOG_RETENTION_DAYS = "7";
		expect(auditRetentionDays()).toBe(7);
		process.env.AUDIT_LOG_RETENTION_DAYS = "nope";
		expect(auditRetentionDays()).toBe(90);
	});

	test("purge deletes entries older than the window and keeps newer ones", async () => {
		const rows = await Effect.runPromise(
			Effect.gen(function* () {
				const sql = yield* SqlClient.SqlClient;
				yield* sql.unsafe(migration);
				const editor = { userId: "u", key: { id: "k", name: "agent" } };
				yield* recordAudit(editor, "createPage", "p1");
				yield* sql`INSERT INTO audit_log (id, at, user_id, key_id, key_name, operation, target)
					VALUES ('old', '2000-01-01T00:00:00.000Z', 'u', 'k', 'agent', 'createPage', 'p0')`;
				yield* purgeAudit(90);
				return yield* listAudit();
			}).pipe(Effect.provide(SqliteClient.layer({ filename: ":memory:" }))),
		);
		expect(rows.map((r) => r.target)).toEqual(["p1"]);
	});
});
