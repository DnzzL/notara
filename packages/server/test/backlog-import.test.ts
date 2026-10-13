/**
 * Importing a Backlog.md project (NOT-156): every task becomes a card of one
 * database, keeping its NOT-n number, fields, criteria, sections and comments;
 * running it again changes nothing.
 */

import { describe, expect, test } from "bun:test";
import path from "node:path";
import * as Comments from "../src/handlers/comments.js";
import * as Databases from "../src/handlers/databases.js";
import * as Pages from "../src/handlers/pages.js";
import { importBacklog } from "../src/import/backlog.js";
import { restWorkspace, WORKSPACE } from "./rest-harness.js";

const dir = path.join(import.meta.dirname, "fixtures/backlog");
const run = (api: ReturnType<typeof restWorkspace>) =>
	api.run(importBacklog({ dir, workspaceId: WORKSPACE, authorId: "ann" }));

const card = async (
	api: ReturnType<typeof restWorkspace>,
	databaseId: string,
	id: string,
) =>
	(
		await api.call(
			"GET",
			`/api/v1/workspaces/${WORKSPACE}/databases/${databaseId}/records/${id}`,
			{ key: "read" },
		)
	).json;

describe("importing a Backlog.md project", () => {
	test("a task becomes a card with its number, fields, criteria and sections", async () => {
		using api = restWorkspace();
		const { databaseId } = await run(api);
		const t = await card(api, databaseId, "NOT-7");
		const old = await card(api, databaseId, "NOT-3");
		expect(t).toMatchObject({
			shortId: "NOT-7",
			title: "Search ignores accents",
			fields: {
				Status: "ready-for-agent",
				Agent: "dev",
				Labels: ["bug"],
				Priority: "high",
				"Depends on": [old.id],
			},
			criteria: [
				{ text: "A search test for creme is red on main", checked: true },
				{ text: "A query matches with or without accents", checked: false },
			],
		});
		expect(t.body).toContain("Users who type « creme »");
		expect(t.body).toContain("Implementation Notes");
		expect(t.body).toContain("Started with the FTS tokenizer.");
	});

	test("an archived task lands as done", async () => {
		using api = restWorkspace();
		const { databaseId } = await run(api);
		expect((await card(api, databaseId, "NOT-3")).fields.Status).toBe("done");
	});

	test("comments come along, their original author written in", async () => {
		using api = restWorkspace();
		const { databaseId } = await run(api);
		const t = await card(api, databaseId, "NOT-7");
		const comments = await api.run(Comments.listComments(t.pageId));
		expect(comments.map((c) => c.body)).toEqual([
			"**@triage** (2026-06-03 09:00): Confirmed on main.",
			"**@dev** (2026-06-04 09:00): Which locale?",
		]);
	});

	test("a subtask (NOT-7.1) gets the next free number and keeps its old id in its body", async () => {
		using api = restWorkspace();
		const { databaseId } = await run(api);
		const sub = await card(api, databaseId, "NOT-10");
		expect(sub.title).toBe("Accent folding table");
		expect(sub.body).toContain("Imported from NOT-7.1, a subtask of NOT-7.");
	});

	test("the next card created goes on after the highest number", async () => {
		using api = restWorkspace();
		const { databaseId } = await run(api);
		const created = await api.call(
			"POST",
			`/api/v1/workspaces/${WORKSPACE}/databases/${databaseId}/records`,
			{ key: "write", body: { title: "New" } },
		);
		expect(created.json.shortId).toBe("NOT-11");
	});

	test("running it again creates nothing", async () => {
		using api = restWorkspace();
		const first = await run(api);
		const second = await run(api);
		expect(second).toEqual({ ...first, imported: 0, skipped: 4 });
		const listed = await api.call(
			"GET",
			`/api/v1/workspaces/${WORKSPACE}/databases/${first.databaseId}/records`,
			{ key: "read" },
		);
		expect(listed.json).toHaveLength(4);
	});

	test("folded titles, headings inside sections and HTML-looking text survive", async () => {
		using api = restWorkspace();
		const { databaseId } = await run(api);
		const t = await card(api, databaseId, "NOT-9");
		expect(t.title).toBe("A title folded over two lines");
		expect(t.body).toContain("Typing <button> shows a button.");
		expect(t.body.match(/Problem Statement/g)).toHaveLength(1);
		expect(t.body).toContain("Implementation Plan");
		expect(t.body).toContain("Assignees: @dev, @pm");
		expect(t.fields.Agent).toBe("dev");
	});

	test("a run that fails midway leaves nothing behind", async () => {
		using api = restWorkspace();
		// A database already holds the NOT prefix: the import fails after it has
		// created its page and database.
		const host = await api.run(
			Pages.createPage({ title: "Mine", parentId: null }),
		);
		await api.run(Databases.createDatabase({ pageId: host.id, name: "Notes" }));
		const err = await api.fail(
			importBacklog({ dir, workspaceId: WORKSPACE, authorId: "ann" }),
		);
		expect(err._tag).toBe("ConflictError");
		expect((await api.run(Pages.listPages)).map((p) => p.title)).toEqual([
			"Mine",
		]);
	});

	test("two tasks with one id are refused before anything is written", async () => {
		using api = restWorkspace();
		const broken = path.join(import.meta.dirname, "fixtures/backlog-broken");
		const err = await api.fail(
			importBacklog({ dir: broken, workspaceId: WORKSPACE, authorId: "ann" }),
		);
		expect(err._tag).toBe("ValidationError");
		expect(await api.run(Pages.listPages)).toEqual([]);
	});

	test("a directory that is not a Backlog.md project is refused", async () => {
		using api = restWorkspace();
		const err = await api.fail(
			importBacklog({
				dir: "/nonexistent",
				workspaceId: WORKSPACE,
				authorId: "ann",
			}),
		);
		expect(err._tag).toBe("ValidationError");
	});
});
