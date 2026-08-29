import { Effect } from "effect";
import { SqlClient } from "effect/unstable/sql";
import { ulid } from "ulidx";
import { WorkspaceDb } from "../db.js";

const STARTER_BLOCKS: ReadonlyArray<{ type: string; content: string }> = [
	{ type: "paragraph", content: "<p></p>" },
];

/**
 * Seed a freshly created workspace with a "Getting Started" page so new users
 * land on something instead of an empty editor. Failures are swallowed by the
 * caller; an unseeded workspace is still a working workspace.
 */
export const seedStarterContent = (workspaceId: string) =>
	Effect.gen(function* () {
		const wdb = yield* WorkspaceDb;
		const layer = wdb.getLayer(workspaceId);

		const work = Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient;
			const pageId = ulid();
			const now = new Date().toISOString();

			yield* sql`
        INSERT INTO pages (id, title, parent_id, sort_order, icon, created_at, updated_at)
        VALUES (${pageId}, ${"Untitled"}, NULL, 1, ${null}, ${now}, ${now})
      `;

			for (let i = 0; i < STARTER_BLOCKS.length; i++) {
				const b = STARTER_BLOCKS[i];
				yield* sql`
          INSERT INTO blocks (id, page_id, type, content, "index", parent_id)
          VALUES (${ulid()}, ${pageId}, ${b.type}, ${b.content}, ${i}, NULL)
        `;
			}
		});

		yield* work.pipe(Effect.provide(layer));
	});
