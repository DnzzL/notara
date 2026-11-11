import { Database } from "bun:sqlite";
import { afterEach, describe, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { makeSqliteLayer } from "../src/db.js";
import * as Blocks from "../src/handlers/blocks.js";
import { applyMigrations } from "../src/platform-db.js";

const dirs: string[] = [];
afterEach(() => {
	for (const d of dirs.splice(0))
		fs.rmSync(d, { recursive: true, force: true });
});

/** Flat blocks a..e on one page, all at the top level, in that order. */
const run = async <A>(
	body: (
		parents: () => Effect.Effect<Record<string, string | null>, any, any>,
	) => Effect.Effect<A, any, any>,
) => {
	const d = fs.mkdtempSync(path.join(os.tmpdir(), "notara-nest-"));
	dirs.push(d);
	const filename = path.join(d, "ws.db");
	const setup = new Database(filename);
	applyMigrations(setup, path.join(import.meta.dir, "..", "migrations"));
	setup.close();
	return Effect.runPromise(
		Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient;
			yield* sql`INSERT INTO pages (id, title) VALUES ('p', 'P')`;
			for (const [i, id] of ["a", "b", "c", "d", "e"].entries())
				yield* sql`INSERT INTO blocks (id, page_id, type, "index") VALUES (${id}, 'p', 'paragraph', ${i})`;
			const parents = () =>
				Blocks.listBlocks("p").pipe(
					Effect.map((bs) =>
						Object.fromEntries(bs.map((b) => [b.id, b.parentId])),
					),
				);
			return yield* body(parents);
		}).pipe(Effect.provide(makeSqliteLayer(filename))),
	);
};

describe("reparentBlock", () => {
	test("in nests under the previous sibling; out lifts and adopts later siblings", async () => {
		const result = await run((parents) =>
			Effect.gen(function* () {
				yield* Blocks.reparentBlock("b", "in");
				yield* Blocks.reparentBlock("c", "in"); // previous sibling of c is a → b stays child of a
				const nested = yield* parents();
				yield* Blocks.reparentBlock("b", "out"); // c (later sibling) becomes b's child
				return { nested, lifted: yield* parents() };
			}),
		);
		expect(result.nested).toEqual({
			a: null,
			b: "a",
			c: "a",
			d: null,
			e: null,
		});
		expect(result.lifted).toEqual({
			a: null,
			b: null,
			c: "b",
			d: null,
			e: null,
		});
	});

	test("in on the first block and out at the top are no-ops", async () => {
		const after = await run((parents) =>
			Effect.gen(function* () {
				yield* Blocks.reparentBlock("a", "in");
				yield* Blocks.reparentBlock("c", "out");
				return yield* parents();
			}),
		);
		expect(after).toEqual({ a: null, b: null, c: null, d: null, e: null });
	});

	test("deleting a parent deletes its descendants", async () => {
		const after = await run((parents) =>
			Effect.gen(function* () {
				yield* Blocks.reparentBlock("b", "in");
				yield* Blocks.reparentBlock("c", "in");
				yield* Blocks.reparentBlock("c", "in"); // c under b
				yield* Blocks.deleteBlock("a");
				return yield* parents();
			}),
		);
		expect(after).toEqual({ d: null, e: null });
	});
});
