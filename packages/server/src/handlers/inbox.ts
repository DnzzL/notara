import { InboxEntry } from "@notara/shared";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { ulid } from "ulidx";
import { publishUnread } from "../inbox-stream.js";
import { resolveEffectiveRelation } from "./permissions.js";

/** Longest comment start an inbox entry shows. */
const EXCERPT = 200;

/** Members a people field of the record behind `pageId` names, if it is one. */
const assigneesOf = (pageId: string) =>
	Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;
		const cells = yield* sql<{ value: string }>`
      SELECT v.value FROM database_records r
      JOIN record_field_values v ON v.record_id = r.id
      JOIN database_fields f ON f.id = v.field_id
      WHERE r.page_id = ${pageId} AND r.is_deleted = 0 AND f.type = 'people'
    `;
		return cells.flatMap(({ value }) => {
			try {
				const ids: unknown = JSON.parse(value);
				return Array.isArray(ids) ? ids.map(String) : [];
			} catch {
				return [];
			}
		});
	});

/**
 * File `comment` in the inbox of everyone it concerns: the members it mentions,
 * then the members its record is assigned to — never someone who cannot see
 * the page, and never its author unless it came through an API key. One entry per member per comment, so an edit
 * only adds the people it newly concerns.
 */
export const notify = (req: {
	workspaceId: string;
	comment: {
		id: string;
		pageId: string;
		authorId: string;
		keyName: string | null;
		mentions: readonly string[];
	};
}) =>
	Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;
		const { id, pageId, authorId, keyName, mentions } = req.comment;
		const reasons = new Map<string, InboxEntry["reason"]>();
		for (const userId of mentions) reasons.set(userId, "mention");
		for (const userId of yield* assigneesOf(pageId))
			if (!reasons.has(userId)) reasons.set(userId, "assigned");
		// Written in the app, the author knows. Written through a key, it is the
		// key's agent speaking, and the key's owner is who it speaks to.
		if (keyName === null) reasons.delete(authorId);
		const now = new Date().toISOString();
		for (const [userId, reason] of reasons) {
			const access = yield* resolveEffectiveRelation(
				userId,
				req.workspaceId,
				pageId,
			);
			if (access === null) continue;
			yield* sql`
        INSERT OR IGNORE INTO inbox_entries (id, user_id, comment_id, page_id, reason, created_at)
        VALUES (${ulid()}, ${userId}, ${id}, ${pageId}, ${reason}, ${now})
      `;
			publishUnread(req.workspaceId, userId, yield* unreadCount(userId));
		}
	});

export const unreadCount = (userId: string) =>
	Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;
		const [row] = yield* sql<{ n: number }>`
      SELECT COUNT(*) as n FROM inbox_entries e JOIN pages p ON p.id = e.page_id
      WHERE e.user_id = ${userId} AND e.read_at IS NULL AND p.is_deleted = 0
    `;
		return row.n;
	});

/** `userId`'s inbox, newest first; entries on trashed pages are left out. */
export const listInbox = (userId: string) =>
	Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;
		const rows = yield* sql`
      SELECT e.id, e.comment_id as "commentId", e.page_id as "pageId",
             p.title as "pageTitle", c.author_id as "authorId",
             substr(c.body, 1, ${EXCERPT}) as excerpt, e.reason,
             e.created_at as "createdAt", e.read_at as "readAt"
      FROM inbox_entries e
      JOIN comments c ON c.id = e.comment_id
      JOIN pages p ON p.id = e.page_id
      WHERE e.user_id = ${userId} AND p.is_deleted = 0
      ORDER BY e.created_at DESC, e.rowid DESC
    `;
		return rows.map((r) => new InboxEntry(r as InboxEntry));
	});

/** Mark `ids` of `userId`'s entries read, or all of them when `ids` is absent. */
export const markRead = (req: {
	workspaceId: string;
	userId: string;
	ids?: readonly string[] | undefined;
}) =>
	Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;
		const now = new Date().toISOString();
		if (req.ids === undefined)
			yield* sql`UPDATE inbox_entries SET read_at = ${now}
        WHERE user_id = ${req.userId} AND read_at IS NULL`;
		else if (req.ids.length > 0)
			yield* sql`UPDATE inbox_entries SET read_at = ${now}
        WHERE user_id = ${req.userId} AND read_at IS NULL AND id IN ${sql.in(req.ids)}`;
		publishUnread(req.workspaceId, req.userId, yield* unreadCount(req.userId));
	});

/** Take comment `id` out of every inbox, and tell those inboxes. */
export const forgetComment = (req: {
	workspaceId: string;
	commentId: string;
}) =>
	Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;
		const holders = yield* sql<{ userId: string }>`
      DELETE FROM inbox_entries WHERE comment_id = ${req.commentId}
      RETURNING user_id as "userId"
    `;
		for (const { userId } of holders)
			publishUnread(req.workspaceId, userId, yield* unreadCount(userId));
	});
