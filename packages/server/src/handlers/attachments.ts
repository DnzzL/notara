/**
 * Attachment access control (ADR-006).
 *
 * An attachment is not an independent resource. It belongs to the page whose
 * block embeds it, and its readability *is* that page's readability: lose
 * access to the page, lose access to the file, with no separate grant to
 * revoke and no cache to wait out.
 *
 * Recovering the workspace is the awkward part. The serving route is reached by
 * `<img src>` / `<embed src>`, which cannot set the `X-Workspace-Id` header the
 * other authenticated routes rely on, and the URL stored in block content is a
 * bare `/attachments/<ulid>.<ext>` written before any of this existed. So the
 * workspace is recovered rather than declared: look for the attachment id in
 * the workspaces the caller is a member of, and stop at the first hit.
 *
 * That search is safe and cheap. Attachment ids are ULIDs, unique across every
 * workspace, so at most one workspace can hold a given one — and because only
 * the caller's own workspaces are searched, a miss tells them nothing about
 * whether the file exists elsewhere. Workspace layers are cached in-process
 * (see db.ts), so the per-request cost is one indexed primary-key lookup per
 * workspace the caller belongs to, short-circuiting on the first hit.
 */
import { SqlClient } from "@effect/sql";
import type { ApiError } from "@notara/shared";
import { Effect } from "effect";
import { WorkspaceDb } from "../db.js";
import { PlatformDb } from "../platform-db.js";
import { checkPagePermission } from "./permissions.js";

/**
 * The attachment id embedded in a served file name.
 *
 * Upload names files `<ulid>.<ext>` and stores the ULID as the attachment's
 * primary key, so the id is everything before the first dot. Returns null for
 * anything that cannot be an id, which the caller reports as a miss.
 */
export const attachmentIdFromFileName = (fileName: string): string | null => {
	const id = fileName.split(".")[0];
	return id && id.length > 0 ? id : null;
};

/**
 * Resolve a served file name to the attachment behind it, if the caller may
 * read the page that owns it.
 *
 * Returns null when no workspace of the caller's holds that attachment — the
 * route turns that into a 404. Fails with the usual 403 when the attachment is
 * found but its page is out of reach, which is a meaningful answer: the caller
 * is a member of the workspace, they just cannot see that page.
 */
export const resolveReadableAttachment = (
	userId: string,
	fileName: string,
): Effect.Effect<
	{ workspaceId: string; pageId: string } | null,
	ApiError,
	PlatformDb | WorkspaceDb
> =>
	Effect.gen(function* () {
		const attachmentId = attachmentIdFromFileName(fileName);
		if (!attachmentId) return null;

		const db = yield* PlatformDb;
		const wdb = yield* WorkspaceDb;

		const memberships = db
			.prepare("SELECT workspace_id FROM workspace_members WHERE user_id = ?")
			.all(userId) as Array<{ workspace_id: string }>;

		for (const { workspace_id: workspaceId } of memberships) {
			const layer = wdb.getLayer(workspaceId);

			const pageId = yield* Effect.gen(function* () {
				const sql = yield* SqlClient.SqlClient;
				const rows = yield* sql<{ page_id: string }>`
					SELECT page_id FROM attachments WHERE id = ${attachmentId}
				`;
				return rows[0]?.page_id ?? null;
			}).pipe(Effect.provide(layer), Effect.orDie);

			if (!pageId) continue;

			// Found it. From here a denial is a real 403, not a miss. A workspace
			// layer that will not open is a defect, not an answer — die rather than
			// letting a config failure read as a permission decision.
			yield* checkPagePermission(userId, workspaceId, pageId, "viewer").pipe(
				Effect.provide(layer),
				Effect.catchTag("ConfigError", Effect.die),
			);

			return { workspaceId, pageId };
		}

		return null;
	});
