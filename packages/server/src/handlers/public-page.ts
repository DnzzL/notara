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
 * most of them are not followed: the block is replaced by an inert placeholder
 * before it leaves the server. Doing it here rather than in the client is the
 * point — a client-side omission is a leak with a View Source.
 *
 * `database` is the one exception, and it gets that second decision rather than
 * a blanket redaction: a database has no ACL of its own, it inherits its owning
 * page's, so the same `canAccessPage` check already used for the shared page
 * itself is reused one hop further — against the publisher, never the reader,
 * exactly as above. Cells whose type points further still (`relation`, `page`,
 * `people`) are blanked individually rather than trusting the same per-block
 * placeholder to cover them.
 */

import { Effect } from "effect";
import { SqlClient } from "effect/unstable/sql";
import { WorkspaceDb } from "../db.js";
import type { PlatformDb } from "../platform-db.js";
import { attachmentIdFromFileName } from "./attachments.js";
import * as Blocks from "./blocks.js";
import * as Databases from "./databases.js";
import * as PageShares from "./page-shares.js";
import * as Pages from "./pages.js";
import { canAccessPage, getDatabasePageId } from "./permissions.js";

/**
 * Block types whose content names something this token does not cover, and
 * which get no second decision — see the module note for why `database` is
 * handled separately in `resolvePublicPage` instead of living here.
 */
const REDACTED_TYPES = new Set(["pageLink", "viewReference", "people"]);

/** Field types whose cell value names a record, page or member outside what
 *  this token covers. Blanked cell by cell rather than trusting the block's
 *  placeholder, since the block itself (the database) is being shown. */
const REDACTED_FIELD_TYPES = new Set(["relation", "page", "people"]);

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

export type PublicDatabase = {
	fields: Array<{
		id: string;
		name: string;
		type: string;
		options: readonly string[] | null;
	}>;
	records: Array<{
		id: string;
		title: string;
		values: Record<string, unknown>;
	}>;
};

/**
 * Blank the content of blocks that reach outside the page.
 *
 * The block is kept rather than dropped so the page still reads as it was
 * written — a paragraph that says "see the table below" is less confusing above
 * an empty placeholder than above nothing. Only the content goes.
 *
 * `database` blocks are blanked too, unless their id is in
 * `accessibleDatabaseIds` — the set `resolvePublicPage` builds after checking
 * the publisher's own access to each referenced database.
 */
export const redactBlocks = <B extends { type: string; content: string }>(
	blocks: readonly B[],
	accessibleDatabaseIds: ReadonlySet<string> = new Set(),
): B[] =>
	blocks.map((b) => {
		if (REDACTED_TYPES.has(b.type)) return { ...b, content: "" };
		if (b.type === "database" && !accessibleDatabaseIds.has(b.content))
			return { ...b, content: "" };
		return b;
	});

/**
 * A database's schema and rows, narrowed for a public reader.
 *
 * Cells of a redacted field type are blanked to `null` rather than left as the
 * raw id list `relation`/`page` store or the user ids `people` stores — the
 * database is being shown, but a column that names another record, page or
 * workspace member is not.
 */
export const buildPublicDatabase = (
	fields: ReadonlyArray<{
		id: string;
		name: string;
		type: string;
		options: readonly string[] | null;
	}>,
	recordsWithValues: ReadonlyArray<{
		record: { id: string; title: string };
		values: Record<string, unknown>;
	}>,
): PublicDatabase => {
	const redactedFieldNames = new Set(
		fields.filter((f) => REDACTED_FIELD_TYPES.has(f.type)).map((f) => f.name),
	);
	return {
		fields: fields.map((f) => ({
			id: f.id,
			name: f.name,
			type: f.type,
			options: f.options,
		})),
		records: recordsWithValues.map(({ record, values }) => ({
			id: record.id,
			title: record.title,
			values: Object.fromEntries(
				Object.entries(values).map(([name, value]) => [
					name,
					redactedFieldNames.has(name) ? null : value,
				]),
			),
		})),
	};
};

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
	{
		page: PublicPage;
		blocks: PublicBlock[];
		databases: Record<string, PublicDatabase>;
		orphanDatabaseIds: string[];
	} | null,
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
			const blockReferencedDatabaseIds = new Set(
				(blocks as unknown as PublicBlock[])
					.filter((b) => b.type === "database" && b.content)
					.map((b) => b.content),
			);

			const accessibleDatabaseIds = new Set<string>();
			const databases: Record<string, PublicDatabase> = {};

			// A database created through the UI (rather than imported) is never
			// pointed at by a block — the editor renders it as an "orphan", after
			// the last block, ordered by its own sort_order. It still lives on this
			// page (page_id = share.pageId), so it inherits the check already done
			// above rather than needing one of its own.
			const localDatabases = yield* Databases.listDatabases(share.pageId);
			for (const db of localDatabases) {
				accessibleDatabaseIds.add(db.id);
				const fields = yield* Databases.listFields(db.id);
				const recordsWithValues = yield* Databases.listRecordsWithValues(db.id);
				databases[db.id] = buildPublicDatabase(fields, recordsWithValues);
			}

			// A block can also point at a database living on a DIFFERENT page (the
			// only way that happens today: a Notion import). That one has no ACL
			// of its own either, so it gets the same publisher recheck as the page
			// itself, just one hop further. Denied or dangling ids fall through to
			// redactBlocks' default blanking; nothing about the check is exposed.
			for (const databaseId of blockReferencedDatabaseIds) {
				if (accessibleDatabaseIds.has(databaseId)) continue;
				const databasePageId = yield* getDatabasePageId(databaseId);
				if (!databasePageId) continue;
				const databaseReadable = yield* canAccessPage(
					share.sharedBy,
					share.workspaceId,
					databasePageId,
					"viewer",
				);
				if (!databaseReadable) continue;

				accessibleDatabaseIds.add(databaseId);
				const fields = yield* Databases.listFields(databaseId);
				const recordsWithValues =
					yield* Databases.listRecordsWithValues(databaseId);
				databases[databaseId] = buildPublicDatabase(fields, recordsWithValues);
			}

			const orphanDatabaseIds = localDatabases
				.map((db) => db.id)
				.filter((id) => !blockReferencedDatabaseIds.has(id));

			return {
				page: publicView(page),
				blocks: redactBlocks(
					blocks as unknown as PublicBlock[],
					accessibleDatabaseIds,
				),
				databases,
				orphanDatabaseIds,
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
