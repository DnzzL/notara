/**
 * Serving one page to a stranger.
 *
 * This is the first unauthenticated read path in the app, so the shape matters
 * more than the code. The whole surface is `resolvePublicPage(token)` → the
 * page and its blocks, or null. Null is the only failure it can express, and
 * the route turns it into a 404 — "revoked", "never existed", "in the bin" and
 * "the publisher can no longer read it" all come out the same, because any
 * distinction between them tells a stranger something about a workspace they
 * have no relationship with.
 *
 * ── Two things a public link must not become ────────────────────────────────
 *
 * **A way around the ACL.** The token is a capability, so serving it is a
 * deliberate bypass of the membership check — but only of that one. The page
 * itself is still subject to the ACL, checked as the PUBLISHER: a capability
 * delegated by a person does not outlive that person's own access. Locking a
 * page therefore cuts every link published from it, and nobody has to remember
 * the links exist. This is why page_shares stores shared_by.
 *
 * **A way into the rest of the workspace.** A page's blocks can point at things
 * outside it — another page, a database, a saved view. Those are not covered by
 * this token and following them would need a second decision per block, which
 * is the kind of decision someone eventually forgets to write (NOT-102). So
 * they are not followed: the block is replaced by an inert placeholder before
 * it leaves the server. Doing it here rather than in the client is the point —
 * a client-side omission is a leak with a View Source.
 */

import { Effect } from "effect";
import { SqlClient } from "effect/unstable/sql";
import { WorkspaceDb } from "../db.js";
import type { PlatformDb } from "../platform-db.js";
import { attachmentIdFromFileName } from "./attachments.js";
import * as Blocks from "./blocks.js";
import * as PageShares from "./page-shares.js";
import * as Pages from "./pages.js";
import { canAccessPage } from "./permissions.js";

/**
 * Block types whose content names something this token does not cover.
 *
 * `pageLink`, `database` and `viewReference` point outside the shared page.
 * `people` holds workspace user ids, which identify members to a reader who has
 * no relationship with the workspace.
 */
const REDACTED_TYPES = new Set([
	"pageLink",
	"database",
	"viewReference",
	"people",
]);

export type PublicBlock = {
	id: string;
	type: string;
	content: string;
	parentId: string | null;
	index: number;
};

export type PublicPage = {
	id: string;
	title: string;
	icon: string | null;
	coverUrl: string | null;
	updatedAt: string;
};

/**
 * Blank the content of blocks that reach outside the page.
 *
 * The block is kept rather than dropped so the page still reads as it was
 * written — a paragraph that says "see the table below" is less confusing above
 * an empty placeholder than above nothing. Only the content goes.
 */
export const redactBlocks = <B extends { type: string; content: string }>(
	blocks: readonly B[],
): B[] =>
	blocks.map((b) => (REDACTED_TYPES.has(b.type) ? { ...b, content: "" } : b));

/**
 * The page, narrowed to what a reader needs.
 *
 * A page row also carries parentId, sortOrder, isFavorite and the soft-delete
 * columns. None of that is any of a stranger's business — parentId in
 * particular names a page this token does not cover — so the projection is
 * written out by hand rather than spread. Adding a column to `pages` cannot
 * quietly widen what is published.
 */
export const publicView = (page: {
	id: string;
	title: string;
	icon: string | null;
	coverUrl: string | null;
	updatedAt: string;
}): PublicPage => ({
	id: page.id,
	title: page.title,
	icon: page.icon,
	coverUrl: page.coverUrl,
	updatedAt: page.updatedAt,
});

/**
 * The page a token names, or null if it names nothing a stranger may read.
 *
 * Every "no" is the same null on purpose — see the module note.
 */
export const resolvePublicPage = (
	token: string,
): Effect.Effect<
	{ page: PublicPage; blocks: PublicBlock[] } | null,
	never,
	PlatformDb | WorkspaceDb
> =>
	Effect.gen(function* () {
		const share = yield* PageShares.resolveToken(token);
		if (!share) return null;

		const wdb = yield* WorkspaceDb;
		// A workspace layer that will not open is a defect, not an answer: dying
		// beats letting a config failure read as "this page is not public".
		const layer = wdb.getLayer(share.workspaceId);

		return yield* Effect.gen(function* () {
			// The publisher's own access, re-checked on every read. This is the
			// line that makes locking a page cut its public link.
			const stillReadable = yield* canAccessPage(
				share.sharedBy,
				share.workspaceId,
				share.pageId,
				"viewer",
			);
			if (!stillReadable) return null;

			// getPage filters is_deleted, so a page in the bin resolves to nothing
			// — a share does not have to be revoked before deleting.
			const page = yield* Pages.getPage(share.pageId).pipe(
				Effect.catch(() => Effect.succeed(null)),
			);
			if (!page) return null;

			const blocks = yield* Blocks.listBlocks(share.pageId);
			return {
				page: publicView(page),
				blocks: redactBlocks(blocks as unknown as PublicBlock[]),
			};
		}).pipe(Effect.provide(layer), Effect.orDie);
	});

/**
 * An attachment embedded in a shared page, reachable by the same token.
 *
 * ADR-006 says an attachment's readability *is* its page's readability. A
 * public page does not change that rule, it changes who the reader is: the
 * token stands in for a session, and it grants exactly the one page it names.
 * So the check is not "may someone read this file" but "does this file belong
 * to the page this token published" — page-scoped, which is why a token cannot
 * be used to walk the workspace's uploads.
 *
 * Returns true when the file may be served. Every no is one false, which the
 * route turns into the same 404 as an unknown token.
 */
export const attachmentBelongsToShare = (
	token: string,
	fileName: string,
): Effect.Effect<boolean, never, PlatformDb | WorkspaceDb> =>
	Effect.gen(function* () {
		const attachmentId = attachmentIdFromFileName(fileName);
		if (!attachmentId) return false;

		const share = yield* PageShares.resolveToken(token);
		if (!share) return false;

		const wdb = yield* WorkspaceDb;
		const layer = wdb.getLayer(share.workspaceId);

		return yield* Effect.gen(function* () {
			// The publisher's access, re-checked here too. Locking a page must cut
			// its images as surely as it cuts its text.
			const stillReadable = yield* canAccessPage(
				share.sharedBy,
				share.workspaceId,
				share.pageId,
				"viewer",
			);
			if (!stillReadable) return false;

			const sql = yield* SqlClient.SqlClient;
			const rows = yield* sql<{ page_id: string }>`
				SELECT page_id FROM attachments WHERE id = ${attachmentId}
			`;
			return rows[0]?.page_id === share.pageId;
		}).pipe(Effect.provide(layer), Effect.orDie);
	});
