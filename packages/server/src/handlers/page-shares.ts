import { Effect } from "effect";
import { PlatformDb } from "../platform-db.js";

/**
 * Enable sharing for a page. Generates a new token if none exists (idempotent).
 * Returns the token.
 */
export const enableSharing = (pageId: string, workspaceId: string) =>
	Effect.gen(function* () {
		const db = yield* PlatformDb;

		// Check if a token already exists
		const existing = db
			.prepare("SELECT token FROM page_shares WHERE page_id = ?")
			.get(pageId) as { token: string } | null;

		if (existing) return { token: existing.token };

		const token = crypto.randomUUID();
		db.prepare(
			"INSERT INTO page_shares (token, workspace_id, page_id) VALUES (?, ?, ?)",
		).run(token, workspaceId, pageId);

		return { token };
	});

/**
 * Disable sharing for a page (remove the share token).
 */
export const disableSharing = (pageId: string) =>
	Effect.gen(function* () {
		const db = yield* PlatformDb;
		db.prepare("DELETE FROM page_shares WHERE page_id = ?").run(pageId);
	});

/**
 * Get the current share token for a page, or null if sharing is disabled.
 */
export const getPageShare = (pageId: string) =>
	Effect.gen(function* () {
		const db = yield* PlatformDb;
		const row = db
			.prepare("SELECT token FROM page_shares WHERE page_id = ?")
			.get(pageId) as { token: string } | null;

		return row ? { token: row.token } : null;
	});

/**
 * Resolve a share token to its page and workspace pair.
 * Returns null if the token doesn't exist or has been revoked.
 */
export const resolveShareToken = (token: string) =>
	Effect.gen(function* () {
		const db = yield* PlatformDb;
		const row = db
			.prepare("SELECT page_id, workspace_id FROM page_shares WHERE token = ?")
			.get(token) as { page_id: string; workspace_id: string } | null;

		return row ? { pageId: row.page_id, workspaceId: row.workspace_id } : null;
	});
