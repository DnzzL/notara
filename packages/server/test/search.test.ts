import { Database } from "bun:sqlite";
import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Effect } from "effect";
import { makeSqliteLayer } from "../src/db.js";
import * as Blocks from "../src/handlers/blocks.js";
import * as Pages from "../src/handlers/pages.js";
import { globalSearch } from "../src/handlers/search.js";

const migrationsDir = path.join(import.meta.dirname, "../migrations");

async function withDb<T>(
	fn: (run: <A>(e: Effect.Effect<A, any, any>) => Promise<A>) => Promise<T>,
) {
	const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "notara-search-"));
	const filename = path.join(tmpDir, "test.db");
	const db = new Database(filename);
	for (const f of fs
		.readdirSync(migrationsDir)
		.filter((f) => f.endsWith(".sql"))
		.sort())
		db.exec(fs.readFileSync(path.join(migrationsDir, f), "utf-8"));
	db.close();
	const layer = makeSqliteLayer(filename);
	try {
		return await fn((e) =>
			Effect.runPromise(Effect.provide(e, layer) as Effect.Effect<any>),
		);
	} finally {
		fs.rmSync(tmpDir, { recursive: true, force: true });
	}
}

const mkPage = (title: string) =>
	Pages.createPage({ title, parentId: null }, { userId: "test-user" });
const mkBlock = (pageId: string, content: string) =>
	Blocks.createBlock(
		{
			pageId,
			type: "paragraph",
			content,
			index: 0,
			parentId: null,
		},
		{ userId: "test-user" },
	);

describe("globalSearch", () => {
	test("page title match returns the page", async () => {
		await withDb(async (run) => {
			const p = await run(mkPage("Engineering Notes"));
			await run(mkPage("Design Ideas"));
			const res = await run(globalSearch("engineer"));
			expect(res.filter((r) => r.type === "page").map((r) => r.id)).toEqual([
				p.id,
			]);
		});
	});

	test("renamed page is found by its new title only", async () => {
		await withDb(async (run) => {
			const p = await run(mkPage("Old name"));
			await run(
				Pages.updatePage({ id: p.id, title: "Fresh name" } as any, {
					userId: "test-user",
				}),
			);
			expect(await run(globalSearch("fresh"))).toHaveLength(1);
			expect(await run(globalSearch("old"))).toHaveLength(0);
		});
	});

	test("block content match returns the block", async () => {
		await withDb(async (run) => {
			const p = await run(mkPage("Host"));
			const b = await run(mkBlock(p.id, "needle in haystack"));
			const res = await run(globalSearch("needle"));
			expect(res.map((r) => [r.type, r.id])).toEqual([["block", b.id]]);
		});
	});

	test("FTS operator characters do not fail the query", async () => {
		await withDb(async (run) => {
			const p = await run(mkPage("agent-browser setup"));
			const b = await run(mkBlock(p.id, "use agent-browser here"));
			for (const q of [
				"agent-browser",
				"foo:bar",
				"a OR",
				"NOT",
				"x*y",
				"^z",
				'"',
				"-",
				"a+b",
				"{a}",
			]) {
				await run(globalSearch(q));
			}
			const res = await run(globalSearch("agent-browser"));
			expect(res.map((r) => r.id).sort()).toEqual([p.id, b.id].sort());
		});
	});

	test("deleted pages and blocks stay excluded", async () => {
		await withDb(async (run) => {
			const p = await run(mkPage("Zebra page"));
			const b = await run(mkBlock(p.id, "zebra content"));
			expect((await run(globalSearch("zebra"))).length).toBe(2);
			await run(Pages.deletePage(p.id));
			expect(await run(globalSearch("zebra"))).toHaveLength(0);
			await run(Pages.restorePage(p.id));
			await run(Blocks.deleteBlock(b.id));
			expect((await run(globalSearch("zebra"))).map((r) => r.type)).toEqual([
				"page",
			]);
		});
	});
});
