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

import type { ApiError } from "@notara/shared";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { WorkspaceDb } from "../db.js";
import * as Membership from "../membership.js";
import type { PlatformDb } from "../platform-db.js";
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
	{ workspaceId: string; pageId: string; artifact: boolean } | null,
	ApiError,
	PlatformDb | WorkspaceDb
> =>
	Effect.gen(function* () {
		const attachmentId = attachmentIdFromFileName(fileName);
		if (!attachmentId) return null;

		const wdb = yield* WorkspaceDb;
		const memberships = yield* Membership.workspacesOf(userId);

		for (const workspaceId of memberships) {
			const layer = wdb.getLayer(workspaceId);

			const row = yield* Effect.gen(function* () {
				const sql = yield* SqlClient.SqlClient;
				const rows = yield* sql<{ page_id: string; artifact: number }>`
					SELECT page_id, artifact FROM attachments WHERE id = ${attachmentId}
				`;
				return rows[0] ?? null;
			}).pipe(Effect.provide(layer), Effect.orDie);

			if (!row) continue;
			const pageId = row.page_id;

			// Found it. From here a denial is a real 403, not a miss. A workspace
			// layer that will not open is a defect, not an answer — die rather than
			// letting a config failure read as a permission decision.
			yield* checkPagePermission(userId, workspaceId, pageId, "viewer").pipe(
				Effect.provide(layer),
				Effect.catchTag("ConfigError", Effect.die),
			);

			return { workspaceId, pageId, artifact: row.artifact === 1 };
		}

		return null;
	});

/**
 * An artifact (ADR-013) is a document that runs its own inline scripts in an
 * opaque origin — not the app's, so not the reader's session — and reaches
 * nothing: no fetch, no CDN, no beacon. Popups are allowed so its links can
 * open, in a new tab and outside the sandbox. Never cached: attaching it again
 * replaces it under the same URL.
 */
const ARTIFACT_HEADERS: Record<string, string> = {
	"Content-Type": "text/html; charset=utf-8",
	"Content-Disposition": "inline",
	"X-Content-Type-Options": "nosniff",
	"Cache-Control": "no-store",
	"Content-Security-Policy":
		"sandbox allow-scripts allow-popups allow-popups-to-escape-sandbox; default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; media-src data: blob:; frame-ancestors 'self'",
};

/**
 * `html` with `<base target="_blank">` as early as it can go, so the
 * artifact's links open in a new tab rather than inside its frame: inside
 * `<head>`, else after the doctype — before it, the document would fall into
 * quirks mode — else first.
 */
export const withBaseTarget = (html: string) => {
	const base = '<base target="_blank">';
	const at =
		/<head\b[^>]*>/i.exec(html) ?? /^\s*<!doctype[^>]*>\s*/i.exec(html);
	return at
		? html.slice(0, at.index + at[0].length) +
				base +
				html.slice(at.index + at[0].length)
		: base + html;
};

/** Attachment types shown in place; anything else is offered as a download. */
const SHOWN: Record<string, string> = {
	".png": "image/png",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".gif": "image/gif",
	".webp": "image/webp",
	".svg": "image/svg+xml",
	".pdf": "application/pdf",
};

/**
 * Response headers for serving attachment `fileName`, whatever a member
 * uploaded. Attachments are served from the app's own origin, so nothing in one
 * may run there: only images and PDFs are shown, everything else is a download,
 * and a `sandbox` policy keeps even a shown image (an SVG can carry script)
 * from running anything when opened directly. PDFs keep the app's policy:
 * browsers' PDF viewers do not render under `sandbox`, and they do not run a
 * PDF's scripts in the page's origin.
 */
export const attachmentHeaders = (
	fileName: string,
	{ artifact = false } = {},
): Record<string, string> => {
	if (artifact) return ARTIFACT_HEADERS;
	const ext = /\.[^.]+$/.exec(fileName)?.[0].toLowerCase() ?? "";
	const shown = SHOWN[ext];
	return {
		"Content-Type": shown ?? "application/octet-stream",
		"Content-Disposition": shown ? "inline" : "attachment",
		"X-Content-Type-Options": "nosniff",
		...(ext === ".pdf"
			? {}
			: {
					"Content-Security-Policy":
						"sandbox; default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'",
				}),
	};
};
