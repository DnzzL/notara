import { Comment, NotFoundError, ValidationError } from "@notara/shared";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { ulid } from "ulidx";
import { forbidden } from "../policy.js";

const COLS = `id, page_id as "pageId", author_id as "authorId", body,
  created_at as "createdAt", updated_at as "updatedAt"`;

const fromRow = (r: unknown) => new Comment(r as Comment);

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

export const listComments = (pageId: string) =>
	Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;
		const rows = yield* sql`
      SELECT ${sql.unsafe(COLS)} FROM comments WHERE page_id = ${pageId}
      ORDER BY created_at ASC, id ASC
    `;
		return rows.map(fromRow);
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
	authorId: string;
	body: string;
}) =>
	Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;
		const body = yield* requireBody(req.body);
		const rows = yield* sql`
      INSERT INTO comments (id, page_id, author_id, body, created_at)
      VALUES (${ulid()}, ${req.pageId}, ${req.authorId}, ${body}, ${new Date().toISOString()})
      RETURNING ${sql.unsafe(COLS)}
    `;
		return fromRow(rows[0]);
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
		return fromRow(rows[0]);
	});

export const deleteComment = (req: { id: string; authorId: string }) =>
	Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;
		yield* requireAuthor(req.id, req.authorId);
		yield* sql`DELETE FROM comments WHERE id = ${req.id}`;
		return { deleted: true };
	});
