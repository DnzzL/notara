/**
 * Comments on pages (NOT-149): a flat thread under any page, records' pages
 * included, where only the author edits or deletes what they wrote.
 */
import { describe, expect, test } from "bun:test";
import * as Comments from "../src/handlers/comments.js";
import * as Databases from "../src/handlers/databases.js";
import * as Pages from "../src/handlers/pages.js";
import { restWorkspace, WORKSPACE } from "./rest-harness.js";

/** A workspace with members ann and bob (see rest-harness). */
const workspace = restWorkspace;

const newPage = (ws: ReturnType<typeof workspace>) =>
	ws.run(Pages.createPage({ title: "P", parentId: null }));

describe("comments", () => {
	test("comments on a page list oldest first, with their author", async () => {
		using ws = workspace();
		const page = await newPage(ws);
		await ws.run(
			Comments.addComment({
				pageId: page.id,
				authorId: "ann",
				workspaceId: WORKSPACE,
				body: "first",
			}),
		);
		await ws.run(
			Comments.addComment({
				pageId: page.id,
				authorId: "bob",
				workspaceId: WORKSPACE,
				body: "second",
			}),
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
			Comments.addComment({
				pageId: page.id,
				authorId: "ann",
				workspaceId: WORKSPACE,
				body: "typo",
			}),
		);
		const edited = await ws.run(
			Comments.updateComment({
				id: c.id,
				authorId: "ann",
				workspaceId: WORKSPACE,
				body: "fixed",
			}),
		);
		expect(edited.body).toBe("fixed");
		expect(edited.updatedAt).not.toBeNull();
	});

	test("nobody else edits or deletes it", async () => {
		using ws = workspace();
		const page = await newPage(ws);
		const c = await ws.run(
			Comments.addComment({
				pageId: page.id,
				authorId: "ann",
				workspaceId: WORKSPACE,
				body: "mine",
			}),
		);
		const edit = await ws.fail(
			Comments.updateComment({
				id: c.id,
				authorId: "bob",
				workspaceId: WORKSPACE,
				body: "hijack",
			}),
		);
		const del = await ws.fail(
			Comments.deleteComment({
				id: c.id,
				workspaceId: WORKSPACE,
				authorId: "bob",
			}),
		);
		expect([edit._tag, del._tag]).toEqual(["AuthError", "AuthError"]);
		expect((await ws.run(Comments.listComments(page.id)))[0].body).toBe("mine");
	});

	test("the author deletes their comment", async () => {
		using ws = workspace();
		const page = await newPage(ws);
		const c = await ws.run(
			Comments.addComment({
				pageId: page.id,
				authorId: "ann",
				workspaceId: WORKSPACE,
				body: "oops",
			}),
		);
		await ws.run(
			Comments.deleteComment({
				id: c.id,
				workspaceId: WORKSPACE,
				authorId: "ann",
			}),
		);
		expect(await ws.run(Comments.listComments(page.id))).toEqual([]);
	});

	test("an empty comment is refused", async () => {
		using ws = workspace();
		const page = await newPage(ws);
		const err = await ws.fail(
			Comments.addComment({
				pageId: page.id,
				authorId: "ann",
				workspaceId: WORKSPACE,
				body: "  \n",
			}),
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
				workspaceId: WORKSPACE,
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
			Comments.addComment({
				pageId: page.id,
				authorId: "ann",
				workspaceId: WORKSPACE,
				body,
			}),
		);
		expect(c.body).toBe(body);
	});

	test("@handles of members become mentions; anything else stays text", async () => {
		using ws = workspace();
		const page = await newPage(ws);
		const c = await ws.run(
			Comments.addComment({
				pageId: page.id,
				workspaceId: WORKSPACE,
				authorId: "ann",
				body: "@Bob can you look? cc @nobody, mail bob@example.test, @bob again",
			}),
		);
		expect(c.mentions).toEqual(["bob"]);
		expect(c.body).toContain("@Bob can you look?");
	});

	test("@handles in code, glued to a word or overlong mention no one", async () => {
		using ws = workspace();
		const page = await newPage(ws);
		const c = await ws.run(
			Comments.addComment({
				pageId: page.id,
				workspaceId: WORKSPACE,
				authorId: "ann",
				body: `\`@bob\` and\n\`\`\`\n@bob\n\`\`\`\né@bob @bobby @bob${"x".repeat(40)}`,
			}),
		);
		expect(c.mentions).toEqual([]);
	});

	test("a handle followed by - or _ still mentions", async () => {
		using ws = workspace();
		const page = await newPage(ws);
		const c = await ws.run(
			Comments.addComment({
				pageId: page.id,
				workspaceId: WORKSPACE,
				authorId: "ann",
				body: "ask @bob-- he knows",
			}),
		);
		expect(c.mentions).toEqual(["bob"]);
	});

	test("editing a comment recomputes its mentions", async () => {
		using ws = workspace();
		const page = await newPage(ws);
		const c = await ws.run(
			Comments.addComment({
				pageId: page.id,
				workspaceId: WORKSPACE,
				authorId: "bob",
				body: "@ann?",
			}),
		);
		const edited = await ws.run(
			Comments.updateComment({
				id: c.id,
				workspaceId: WORKSPACE,
				authorId: "bob",
				body: "never mind",
			}),
		);
		expect(edited.mentions).toEqual([]);
		expect((await ws.run(Comments.listComments(page.id)))[0].mentions).toEqual(
			[],
		);
	});

	test("purging a page deletes its comments", async () => {
		using ws = workspace();
		const page = await newPage(ws);
		const c = await ws.run(
			Comments.addComment({
				pageId: page.id,
				authorId: "ann",
				workspaceId: WORKSPACE,
				body: "gone",
			}),
		);
		await ws.run(Databases.purgePage(page.id));
		const err = await ws.fail(
			Comments.deleteComment({
				id: c.id,
				workspaceId: WORKSPACE,
				authorId: "ann",
			}),
		);
		expect(err._tag).toBe("NotFoundError");
	});
});

const P = (pageId: string) =>
	`/api/v1/workspaces/${WORKSPACE}/pages/${pageId}/comments`;

describe("comments over REST", () => {
	test("a key comments as its user, and the comment names the key", async () => {
		using api = restWorkspace();
		const page = await api.run(
			Pages.createPage({ title: "P", parentId: null }),
		);
		const posted = await api.call("POST", P(page.id), {
			key: "write",
			body: { body: "Blocked: which locale?" },
		});
		expect(posted.status).toBe(201);
		expect(posted.json).toMatchObject({ authorId: "ann", keyName: "docket" });

		const listed = await api.call("GET", P(page.id), { key: "read" });
		expect(listed.status).toBe(200);
		expect(listed.json.map((c: { body: string }) => c.body)).toEqual([
			"Blocked: which locale?",
		]);
	});

	test("a comment through a key mentions by @handle too", async () => {
		using api = restWorkspace();
		const page = await api.run(
			Pages.createPage({ title: "P", parentId: null }),
		);
		const posted = await api.call("POST", P(page.id), {
			key: "write",
			body: { body: "@bob blocked on the locale" },
		});
		expect(posted.json.mentions).toEqual(["bob"]);
	});

	test("a read key cannot comment", async () => {
		using api = restWorkspace();
		const page = await api.run(
			Pages.createPage({ title: "P", parentId: null }),
		);
		const res = await api.call("POST", P(page.id), {
			key: "read",
			body: { body: "hi" },
		});
		expect(res.status).toBe(403);
	});

	test("a key from outside the workspace neither reads nor comments", async () => {
		using api = restWorkspace();
		const page = await api.run(
			Pages.createPage({ title: "P", parentId: null }),
		);
		const read = await api.call("GET", P(page.id), { key: "eve" });
		const write = await api.call("POST", P(page.id), {
			key: "eve",
			body: { body: "hi" },
		});
		expect([read.status, write.status]).toEqual([403, 403]);
	});

	test("a body that is not a string is refused with 422", async () => {
		using api = restWorkspace();
		const page = await api.run(
			Pages.createPage({ title: "P", parentId: null }),
		);
		const res = await api.call("POST", P(page.id), { key: "write", body: {} });
		expect(res.status).toBe(422);
	});

	test("a comment written in the app names no key", async () => {
		using ws = workspace();
		const page = await newPage(ws);
		const c = await ws.run(
			Comments.addComment({
				pageId: page.id,
				authorId: "ann",
				workspaceId: WORKSPACE,
				body: "hi",
			}),
		);
		expect(c.keyName).toBeNull();
	});
});
