/**
 * Comments on pages (NOT-149): a flat thread under any page, records' pages
 * included, where only the author edits or deletes what they wrote.
 */
import { Database } from "bun:sqlite";
import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { SqliteClient } from "@effect/sql-sqlite-bun";
import { Effect } from "effect";
import type { SqlClient } from "effect/sql";
import * as Comments from "../src/handlers/comments.js";
import * as Databases from "../src/handlers/databases.js";
import * as Pages from "../src/handlers/pages.js";

const migrationsDir = path.join(
	import.meta.dirname || __dirname,
	"../migrations",
);

function workspace() {
	const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "notara-comments-"));
	const filename = path.join(tmpDir, "test.db");
	const db = new Database(filename);
	for (const file of fs
		.readdirSync(migrationsDir)
		.filter((f) => f.endsWith(".sql"))
		.sort())
		db.exec(fs.readFileSync(path.join(migrationsDir, file), "utf-8"));
	db.close();
	const run = <A, E>(eff: Effect.Effect<A, E, SqlClient.SqlClient>) =>
		eff.pipe(
			Effect.provide(SqliteClient.layer({ filename })),
			Effect.runPromise,
		);
	return {
		run,
		fail: <A, E>(eff: Effect.Effect<A, E, SqlClient.SqlClient>) =>
			run(Effect.flip(eff)),
		[Symbol.dispose]: () => fs.rmSync(tmpDir, { recursive: true, force: true }),
	};
}

const newPage = (ws: ReturnType<typeof workspace>) =>
	ws.run(Pages.createPage({ title: "P", parentId: null }));

describe("comments", () => {
	test("comments on a page list oldest first, with their author", async () => {
		using ws = workspace();
		const page = await newPage(ws);
		await ws.run(
			Comments.addComment({ pageId: page.id, authorId: "ann", body: "first" }),
		);
		await ws.run(
			Comments.addComment({ pageId: page.id, authorId: "bob", body: "second" }),
		);
		const listed = await ws.run(Comments.listComments(page.id));
		expect(listed.map((c) => [c.authorId, c.body])).toEqual([
			["ann", "first"],
			["bob", "second"],
		]);
	});

	test("the author edits their comment", async () => {
		using ws = workspace();
		const page = await newPage(ws);
		const c = await ws.run(
			Comments.addComment({ pageId: page.id, authorId: "ann", body: "typo" }),
		);
		const edited = await ws.run(
			Comments.updateComment({ id: c.id, authorId: "ann", body: "fixed" }),
		);
		expect(edited.body).toBe("fixed");
		expect(edited.updatedAt).not.toBeNull();
	});

	test("nobody else edits or deletes it", async () => {
		using ws = workspace();
		const page = await newPage(ws);
		const c = await ws.run(
			Comments.addComment({ pageId: page.id, authorId: "ann", body: "mine" }),
		);
		const edit = await ws.fail(
			Comments.updateComment({ id: c.id, authorId: "bob", body: "hijack" }),
		);
		const del = await ws.fail(
			Comments.deleteComment({ id: c.id, authorId: "bob" }),
		);
		expect([edit._tag, del._tag]).toEqual(["AuthError", "AuthError"]);
		expect((await ws.run(Comments.listComments(page.id)))[0].body).toBe("mine");
	});

	test("the author deletes their comment", async () => {
		using ws = workspace();
		const page = await newPage(ws);
		const c = await ws.run(
			Comments.addComment({ pageId: page.id, authorId: "ann", body: "oops" }),
		);
		await ws.run(Comments.deleteComment({ id: c.id, authorId: "ann" }));
		expect(await ws.run(Comments.listComments(page.id))).toEqual([]);
	});

	test("an empty comment is refused", async () => {
		using ws = workspace();
		const page = await newPage(ws);
		const err = await ws.fail(
			Comments.addComment({ pageId: page.id, authorId: "ann", body: "  \n" }),
		);
		expect(err._tag).toBe("ValidationError");
	});

	test("a comment over 10 000 characters is refused", async () => {
		using ws = workspace();
		const page = await newPage(ws);
		const err = await ws.fail(
			Comments.addComment({
				pageId: page.id,
				authorId: "ann",
				body: "x".repeat(10_001),
			}),
		);
		expect(err._tag).toBe("ValidationError");
	});

	test("the body is stored as written, indentation included", async () => {
		using ws = workspace();
		const page = await newPage(ws);
		const body = "    indented code\nnext line";
		const c = await ws.run(
			Comments.addComment({ pageId: page.id, authorId: "ann", body }),
		);
		expect(c.body).toBe(body);
	});

	test("purging a page deletes its comments", async () => {
		using ws = workspace();
		const page = await newPage(ws);
		const c = await ws.run(
			Comments.addComment({ pageId: page.id, authorId: "ann", body: "gone" }),
		);
		await ws.run(Databases.purgePage(page.id));
		const err = await ws.fail(
			Comments.deleteComment({ id: c.id, authorId: "ann" }),
		);
		expect(err._tag).toBe("NotFoundError");
	});
});
