import { Database } from "bun:sqlite";
import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { SqliteClient } from "@effect/sql-sqlite-bun";
import { Effect } from "effect";
import { SqlClient } from "effect/unstable/sql";
import * as Blocks from "../src/handlers/blocks.js";
import * as Databases from "../src/handlers/databases.js";
import * as Pages from "../src/handlers/pages.js";

/**
 * Trashing a page takes its subtree with it (NOT-141).
 *
 * Deleting a page only ever marked that one row, while the sidebar builds its
 * tree from parent_id — so the descendants vanished from the UI without being
 * in the trash, could not be restored on their own, and, once the retention
 * sweep purged the parent row, were left pointing at a parent that no longer
 * existed. Invisible for good, with their blocks intact.
 *
 * The subtree is now marked with the page that took it down, which is also
 * what tells restore what to bring back and what to leave behind.
 */

function makeTestDb() {
	const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "notara-trash-"));
	return { filename: path.join(tmpDir, "test.db"), tmpDir };
}

const TestDbLayer = (filename: string) => SqliteClient.layer({ filename });

const migrationsDir = path.join(
	import.meta.dirname || __dirname,
	"../migrations",
);

function runMigrations(filename: string) {
	const db = new Database(filename);
	try {
		for (const file of fs
			.readdirSync(migrationsDir)
			.filter((f) => f.endsWith(".sql"))
			.sort()) {
			db.exec(fs.readFileSync(path.join(migrationsDir, file), "utf-8"));
		}
	} finally {
		db.close();
	}
}

/** parent → child → grandchild, plus a block on the grandchild. */
async function seedTree(filename: string) {
	const run = <A>(e: Effect.Effect<A, any, SqlClient.SqlClient>) =>
		e.pipe(Effect.provide(TestDbLayer(filename)), Effect.runPromise);
	const parent = await run(
		Pages.createPage({ title: "Parent", parentId: null }),
	);
	const child = await run(
		Pages.createPage({ title: "Child", parentId: parent.id }),
	);
	const grandchild = await run(
		Pages.createPage({ title: "Grandchild", parentId: child.id }),
	);
	await run(
		Blocks.createBlock({
			pageId: grandchild.id,
			type: "paragraph",
			content: "<p>deep</p>",
			index: 0,
			parentId: null,
		}),
	);
	return { run, parent, child, grandchild };
}

describe("trashing a page takes its subtree", () => {
	test("descendants are trashed with the page, and only it is listed", async () => {
		const { filename, tmpDir } = makeTestDb();
		try {
			runMigrations(filename);
			const { run, parent, child, grandchild } = await seedTree(filename);

			await run(Pages.deletePage(parent.id));

			const live = await run(Pages.listPages);
			expect(live.map((p) => p.id)).not.toContain(parent.id);
			expect(live.map((p) => p.id)).not.toContain(child.id);
			expect(live.map((p) => p.id)).not.toContain(grandchild.id);

			// The trash names what the user deleted, not everything it dragged
			// along — otherwise one delete fills the trash with three entries.
			const trash = await run(Databases.listTrash);
			expect(trash.pages.map((p) => p.id)).toEqual([parent.id]);
		} finally {
			fs.rmSync(tmpDir, { recursive: true, force: true });
		}
	});

	test("restoring the page brings the subtree back", async () => {
		const { filename, tmpDir } = makeTestDb();
		try {
			runMigrations(filename);
			const { run, parent, child, grandchild } = await seedTree(filename);

			await run(Pages.deletePage(parent.id));
			const restored = await run(Pages.restorePage(parent.id));
			expect(restored.restored).toBe(true);

			const live = await run(Pages.listPages);
			expect(live.map((p) => p.id).sort()).toEqual(
				[parent.id, child.id, grandchild.id].sort(),
			);
		} finally {
			fs.rmSync(tmpDir, { recursive: true, force: true });
		}
	});

	test("a page trashed on its own stays trashed when its parent is restored", async () => {
		const { filename, tmpDir } = makeTestDb();
		try {
			runMigrations(filename);
			const { run, parent, child, grandchild } = await seedTree(filename);

			// The child was deleted deliberately, before the parent was.
			await run(Pages.deletePage(child.id));
			await run(Pages.deletePage(parent.id));
			await run(Pages.restorePage(parent.id));

			const live = await run(Pages.listPages);
			expect(live.map((p) => p.id)).toContain(parent.id);
			expect(live.map((p) => p.id)).not.toContain(child.id);
			expect(live.map((p) => p.id)).not.toContain(grandchild.id);

			// And it is back in the trash under its own name, restorable on its own.
			const trash = await run(Databases.listTrash);
			expect(trash.pages.map((p) => p.id)).toEqual([child.id]);
		} finally {
			fs.rmSync(tmpDir, { recursive: true, force: true });
		}
	});

	test("purging the page purges the descendants and their blocks", async () => {
		const { filename, tmpDir } = makeTestDb();
		try {
			runMigrations(filename);
			const { run, parent, child, grandchild } = await seedTree(filename);

			await run(Pages.deletePage(parent.id));
			await run(Databases.purgePage(parent.id));

			const left = await run(
				Effect.gen(function* () {
					const sql = yield* SqlClient.SqlClient;
					const pages = yield* sql`SELECT COUNT(*) as cnt FROM pages`;
					const blocks =
						yield* sql`SELECT COUNT(*) as cnt FROM blocks WHERE page_id = ${grandchild.id}`;
					return {
						pages: Number(pages[0].cnt),
						blocks: Number(blocks[0].cnt),
					};
				}),
			);
			// No row left pointing at a parent that no longer exists.
			expect(left.pages).toBe(0);
			expect(left.blocks).toBe(0);
			expect([parent.id, child.id]).toHaveLength(2);
		} finally {
			fs.rmSync(tmpDir, { recursive: true, force: true });
		}
	});
});
