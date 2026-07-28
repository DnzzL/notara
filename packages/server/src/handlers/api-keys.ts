import { ApiKey, ApiKeyCreated } from "@notara/shared";
import { Effect } from "effect";
import { ulid } from "ulidx";
import { generateApiKey } from "../api-v1/auth.js";
import { PlatformDb } from "../platform-db.js";

type ApiKeyRow = {
	id: string;
	user_id: string;
	name: string;
	key_hash: string;
	key_prefix: string;
	created_at: string;
	last_used_at: string | null;
};

const toApiKey = (row: ApiKeyRow): ApiKey =>
	new ApiKey({
		id: row.id,
		name: row.name,
		keyPrefix: row.key_prefix,
		createdAt: row.created_at,
		lastUsedAt: row.last_used_at,
	});

export const listApiKeys = (userId: string) =>
	Effect.gen(function* () {
		const db = yield* PlatformDb;
		const rows = db
			.prepare(
				"SELECT * FROM api_keys WHERE user_id = ? ORDER BY created_at DESC",
			)
			.all(userId) as ApiKeyRow[];
		return rows.map(toApiKey);
	});

export const createApiKey = (req: { userId: string; name: string }) =>
	Effect.gen(function* () {
		const db = yield* PlatformDb;
		const id = ulid();
		const { raw, hash, prefix } = generateApiKey();
		const now = new Date().toISOString();

		db.prepare(
			"INSERT INTO api_keys (id, user_id, name, key_hash, key_prefix, created_at) VALUES (?, ?, ?, ?, ?, ?)",
		).run(id, req.userId, req.name, hash, prefix, now);

		return new ApiKeyCreated({
			id,
			name: req.name,
			keyPrefix: prefix,
			rawKey: raw,
			createdAt: now,
		});
	});

export const revokeApiKey = (req: { userId: string; id: string }) =>
	Effect.gen(function* () {
		const db = yield* PlatformDb;
		db.prepare("DELETE FROM api_keys WHERE id = ? AND user_id = ?").run(
			req.id,
			req.userId,
		);
	});
