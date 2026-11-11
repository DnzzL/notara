import { AuditEntry } from "@notara/shared";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { ulid } from "ulidx";
import type { Editor } from "../editor.js";

/** Days an entry is kept (ADR-015). `AUDIT_LOG_RETENTION_DAYS`, default 90. */
export const auditRetentionDays = () => {
	const n = Number.parseInt(process.env.AUDIT_LOG_RETENTION_DAYS ?? "", 10);
	return n > 0 ? n : 90;
};

/** Append one API-key write. Ids only: no key secret, no page content. */
export const recordAudit = (
	editor: Editor,
	operation: string,
	target: string | null,
) =>
	Effect.gen(function* () {
		if (!editor.key) return;
		const sql = yield* SqlClient.SqlClient;
		yield* sql`INSERT INTO audit_log (id, at, user_id, key_id, key_name, operation, target)
			VALUES (${ulid()}, ${new Date().toISOString()}, ${editor.userId}, ${editor.key.id}, ${editor.key.name}, ${operation}, ${target})`;
	});

/** Newest first, optionally one key's entries. */
export const listAudit = (keyId?: string) =>
	Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;
		const rows = yield* sql<{
			id: string;
			at: string;
			key_id: string;
			key_name: string;
			operation: string;
			target: string | null;
		}>`SELECT id, at, key_id, key_name, operation, target FROM audit_log
			WHERE ${keyId ?? null} IS NULL OR key_id = ${keyId ?? null}
			ORDER BY at DESC, id DESC LIMIT 200`;
		return rows.map(
			(r) =>
				new AuditEntry({
					id: r.id,
					at: r.at,
					keyId: r.key_id,
					keyName: r.key_name,
					operation: r.operation,
					target: r.target,
				}),
		);
	});

export const purgeAudit = (days: number) =>
	Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;
		const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();
		yield* sql`DELETE FROM audit_log WHERE at < ${cutoff}`;
	});
