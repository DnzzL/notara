import { Backlink, NotFoundError } from "@notara/shared";
import { Effect } from "effect";
import { SqlClient } from "effect/unstable/sql";
import { ulid } from "ulidx";
import { BLOCK_COLS, blockFromRow } from "../mappers.js";

/**
 * THE BLOCK CONTENT CONTRACT — one shape, both API surfaces.
 *
 * A block's content is **a string**, and how to read it depends on the block's
 * type. Text-bearing blocks (paragraph, headings, lists, todo, quote, code,
 * toggle, callout) hold HTML, because a TipTap editor produces and consumes
 * HTML. Structured blocks (image, pdf, file, pageLink, database, viewReference,
 * people) hold JSON.
 *
 * This used to be decided in the REST adapter rather than here, and it decided
 * differently: it ran `JSON.parse` on the way out and fell back to the raw
 * string when that failed. So REST returned an object for an image and a string
 * for a paragraph, while RPC returned the string either way — one module, two
 * contracts, chosen by which door the caller came through.
 *
 * The OpenAPI document then described a third thing that was true of neither:
 * `{ "text": "…" }` for every text block. Nobody could have written a correct
 * client against it, and the write path's object-to-JSON coercion meant anyone
 * who tried stored `{"text":"hi"}` where the editor expects `<p>hi</p>` — a
 * block that renders blank. That coercion is gone: a non-string content is now
 * refused with a message saying what to send, rather than accepted and quietly
 * corrupted.
 */
export const isValidContent = (raw: unknown): raw is string =>
	typeof raw === "string";

/** Why a rejected content payload was rejected, in terms a caller can act on. */
export const CONTENT_CONTRACT =
	'Block content must be a string. Text blocks hold HTML (e.g. "<p>Hello</p>"); ' +
	"image, pdf, file, pageLink, database, viewReference and people blocks hold a " +
	'JSON string (e.g. "{\\"url\\":\\"/attachments/x.png\\"}").';

export const getBlockPageId = (id: string) =>
	Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;
		const rows = yield* sql<{ page_id: string }>`
      SELECT page_id FROM blocks WHERE id = ${id}
    `;
		return rows[0]?.page_id ?? null;
	});

export const listBlocks = (pageId: string) =>
	Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;
		return yield* sql
			.unsafe(
				`SELECT ${BLOCK_COLS} FROM blocks WHERE page_id = ? ORDER BY "index" ASC`,
				[pageId],
			)
			.pipe(Effect.map((rows) => rows.map(blockFromRow)));
	});

/**
 * A caller-supplied block id is honoured only if it is a well-formed ULID.
 * Anything else gets a fresh one rather than an error: the id is a convenience
 * for the client (see the RPC payload), not a field worth failing a write over.
 */
const ULID_RE = /^[0-9A-HJKMNP-TV-Z]{26}$/;

export const createBlock = (req: {
	pageId: string;
	type: string;
	content: string;
	index: number;
	parentId: string | null;
	id?: string | undefined;
}) =>
	Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;
		return yield* sql.withTransaction(
			Effect.gen(function* () {
				const id = req.id && ULID_RE.test(req.id) ? req.id : ulid();
				// Shift later blocks down so the new block lands at exactly req.index
				// without colliding.
				yield* sql`
        UPDATE blocks SET "index" = "index" + 1
        WHERE page_id = ${req.pageId} AND "index" >= ${req.index}
      `;
				const rows = yield* sql`
        INSERT INTO blocks (id, page_id, type, content, "index", parent_id)
        VALUES (${id}, ${req.pageId}, ${req.type}, ${req.content}, ${req.index}, ${req.parentId})
        RETURNING ${sql.unsafe(BLOCK_COLS)}
      `;
				return blockFromRow(rows[0]);
			}),
		);
	});

export const updateBlock = (req: {
	id: string;
	content: string;
	type?: string;
}) =>
	Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;
		const rows = yield* req.type
			? sql`
        UPDATE blocks SET content = ${req.content}, type = ${req.type} WHERE id = ${req.id}
        RETURNING ${sql.unsafe(BLOCK_COLS)}
      `
			: sql`
        UPDATE blocks SET content = ${req.content} WHERE id = ${req.id}
        RETURNING ${sql.unsafe(BLOCK_COLS)}
      `;
		if (rows.length === 0)
			return yield* new NotFoundError({ resource: "block", id: req.id });
		return blockFromRow(rows[0]);
	});

export const deleteBlock = (id: string) =>
	Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;
		yield* sql`DELETE FROM blocks WHERE id = ${id}`;
	});

export const reorderBlocks = (pageId: string, blockIds: string[]) =>
	Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;
		return yield* sql.withTransaction(
			Effect.gen(function* () {
				for (let i = 0; i < blockIds.length; i++) {
					yield* sql`UPDATE blocks SET "index" = ${i} WHERE id = ${blockIds[i]} AND page_id = ${pageId}`;
				}
				const rows = yield* sql.unsafe(
					`SELECT ${BLOCK_COLS} FROM blocks WHERE page_id = ? ORDER BY "index" ASC`,
					[pageId],
				);
				return rows.map(blockFromRow);
			}),
		);
	});

/**
 * Get all blocks that reference a specific page (backlinks).
 */
export const getBacklinks = (pageId: string) =>
	Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;
		const rows = yield* sql<{
			blockId: string;
			pageId: string;
			pageTitle: string;
			blockType: string;
			content: string;
		}>`
      SELECT b.id as "blockId", b.page_id as "pageId", p.title as "pageTitle", b.type as "blockType", b.content
      FROM blocks b
      JOIN pages p ON b.page_id = p.id
      WHERE (b.content LIKE ${`%data-page-ref="${pageId}"%`}
         OR (b.type = 'pageLink' AND b.content = ${pageId}))
        AND p.is_deleted = 0
    `;
		return rows.map(
			(r) =>
				new Backlink({
					blockId: r.blockId,
					pageId: r.pageId,
					pageTitle: r.pageTitle,
					blockType: r.blockType,
					content: r.content,
				}),
		);
	});
