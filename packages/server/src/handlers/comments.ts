import { Comment, NotFoundError, ValidationError } from "@notara/shared";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { ulid } from "ulidx";
import { HANDLE, membersByHandle } from "../member-handles.js";
import { PlatformDb } from "../platform-db.js";
import { forbidden } from "../policy.js";
import * as Inbox from "./inbox.js";

const COLS = `id, page_id as "pageId", author_id as "authorId", body,
  created_at as "createdAt", updated_at as "updatedAt", key_name as "keyName"`;

/** Longest comment accepted, here and in the RPC schema (CommentBody). */
export const MAX_COMMENT_LENGTH = 10_000;

/** A comment's body, kept as written: refused when blank or too long. */
const requireBody = (body: string) =>
	body.trim() === ""
		? Effect.fail(new ValidationError({ message: "A comment cannot be empty" }))
		: body.length > MAX_COMMENT_LENGTH
			? Effect.fail(
					new ValidationError({
						message: `A comment is at most ${MAX_COMMENT_LENGTH} characters`,
					}),
				)
			: Effect.succeed(body);

/**
 * `@word` not glued to a letter, digit, `@` or `.` before it (words, emails).
 * The word is taken whole, so `@bobby` is not `@bob`; trailing `-` and `_` are
 * punctuation, since a handle ends with a letter or digit.
 */
const MENTION = /(?<![\p{L}\p{N}_@.])@([a-z0-9][a-z0-9_-]*)/giu;

/** Code spans and fenced blocks: an `@handle` in code mentions no one. */
const CODE = /```[\s\S]*?```|`[^`\n]*`/g;

/**
 * The members of `workspaceId` that `body` mentions by handle. A handle no
 * member holds is just text.
 */
const mentionedIn = (workspaceId: string, body: string) =>
	Effect.gen(function* () {
		const handles = [
			...new Set(
				[...body.replace(CODE, " ").matchAll(MENTION)]
					.map((m) => m[1].toLowerCase().replace(/[-_]+$/, ""))
					.filter((h) => HANDLE.test(h)),
			),
		];
		return membersByHandle(yield* PlatformDb, workspaceId, handles);
	});

/** Replace who comment `id` mentions. */
const writeMentions = (id: string, userIds: readonly string[]) =>
	Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;
		yield* sql`DELETE FROM comment_mentions WHERE comment_id = ${id}`;
		for (const userId of userIds)
			yield* sql`INSERT INTO comment_mentions (comment_id, user_id) VALUES (${id}, ${userId})`;
	});

/** Comment rows, each with who it mentions. */
const withMentions = (rows: readonly unknown[]) =>
	Effect.gen(function* () {
		if (rows.length === 0) return [];
		const sql = yield* SqlClient.SqlClient;
		const ids = rows.map((r) => (r as { id: string }).id);
		const mentions = yield* sql<{ commentId: string; userId: string }>`
      SELECT comment_id as "commentId", user_id as "userId" FROM comment_mentions
      WHERE comment_id IN ${sql.in(ids)} ORDER BY rowid
    `;
		return rows.map(
			(r) =>
				new Comment({
					...(r as Omit<Comment, "mentions">),
					mentions: mentions
						.filter((m) => m.commentId === (r as { id: string }).id)
						.map((m) => m.userId),
				}),
		);
	});

/**
 * What every write of a comment ends with: resolve who `body` mentions, file
 * it in the inboxes it concerns, and return it as the API shows it.
 */
const settle = (
	workspaceId: string,
	id: string,
	body: string,
	rows: readonly unknown[],
) =>
	Effect.gen(function* () {
		yield* writeMentions(id, yield* mentionedIn(workspaceId, body));
		const [comment] = yield* withMentions(rows);
		yield* Inbox.notify({ workspaceId, comment });
		return comment;
	});

export const listComments = (pageId: string) =>
	Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;
		return yield* withMentions(
			yield* sql`
        SELECT ${sql.unsafe(COLS)} FROM comments WHERE page_id = ${pageId}
        -- Two comments written in the same millisecond keep the order they were
        -- written in; ULIDs of one millisecond do not sort by time.
        ORDER BY created_at ASC, rowid ASC
      `,
		);
	});

/** Who wrote comment `id` and where it sits; not found when it is gone. */
const findComment = (id: string) =>
	Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;
		const rows = yield* sql<{ pageId: string; authorId: string }>`
      SELECT page_id as "pageId", author_id as "authorId" FROM comments WHERE id = ${id}
    `;
		if (rows.length === 0)
			return yield* new NotFoundError({ resource: "comment", id });
		return rows[0];
	});

/** The page a comment is on, for the caller's permission check. */
export const commentPageId = (id: string) =>
	findComment(id).pipe(Effect.map((c) => c.pageId));

export const addComment = (req: {
	pageId: string;
	/** The workspace whose members' @handles the body may mention. */
	workspaceId: string;
	authorId: string;
	body: string;
	/** The API key it comes through, when it does. */
	keyName?: string | null;
}) =>
	Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;
		const body = yield* requireBody(req.body);
		const id = ulid();
		const rows = yield* sql`
      INSERT INTO comments (id, page_id, author_id, body, created_at, key_name)
      VALUES (${id}, ${req.pageId}, ${req.authorId}, ${body}, ${new Date().toISOString()}, ${req.keyName ?? null})
      RETURNING ${sql.unsafe(COLS)}
    `;
		return yield* settle(req.workspaceId, id, body, rows);
	});

/** Fails unless `authorId` wrote comment `id`. */
const requireAuthor = (id: string, authorId: string) =>
	Effect.gen(function* () {
		const comment = yield* findComment(id);
		if (comment.authorId !== authorId)
			return yield* forbidden("Only the author can change a comment");
	});

export const updateComment = (req: {
	id: string;
	workspaceId: string;
	authorId: string;
	body: string;
}) =>
	Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;
		yield* requireAuthor(req.id, req.authorId);
		const body = yield* requireBody(req.body);
		const rows = yield* sql`
      UPDATE comments SET body = ${body}, updated_at = ${new Date().toISOString()}
      WHERE id = ${req.id}
      RETURNING ${sql.unsafe(COLS)}
    `;
		return yield* settle(req.workspaceId, req.id, body, rows);
	});

export const deleteComment = (req: {
	id: string;
	workspaceId: string;
	authorId: string;
}) =>
	Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;
		yield* requireAuthor(req.id, req.authorId);
		yield* sql`DELETE FROM comment_mentions WHERE comment_id = ${req.id}`;
		yield* Inbox.forgetComment({
			workspaceId: req.workspaceId,
			commentId: req.id,
		});
		yield* sql`DELETE FROM comments WHERE id = ${req.id}`;
		return { deleted: true };
	});
