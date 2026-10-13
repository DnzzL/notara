/**
 * A card in one call (NOT-154): a runner gets a record's title, field values,
 * body as markdown and acceptance criteria — the to-do blocks of its page.
 */
import { describe, expect, test } from "bun:test";
import { Effect } from "effect";
import { blockToMarkdown } from "../src/export/page.js";
import * as Blocks from "../src/handlers/blocks.js";
import * as Databases from "../src/handlers/databases.js";
import * as Pages from "../src/handlers/pages.js";
import { restWorkspace, WORKSPACE } from "./rest-harness.js";

const card = (api: ReturnType<typeof restWorkspace>, withPage: boolean) =>
	api.run(
		Effect.gen(function* () {
			const page = yield* Pages.createPage({ title: "P", parentId: null });
			const db = yield* Databases.createDatabase({
				pageId: page.id,
				name: "Notara",
			});
			const status = yield* Databases.createField({
				databaseId: db.id,
				name: "Status",
				type: "select",
				options: ["ready-for-agent"],
				relationTargetDbId: null,
			});
			const rec = yield* Databases.createRecord({
				databaseId: db.id,
				title: "Search ignores accents",
			});
			yield* Databases.updateFieldValue({
				recordId: rec.id,
				fieldId: status.id,
				value: "ready-for-agent",
			});
			if (withPage) {
				const { pageId } = yield* Databases.openRecordAsPage(rec.id);
				const blocks: Array<[string, string]> = [
					[
						"paragraph",
						"<p>Users typing <strong>creme</strong> find &amp; see nothing.</p>",
					],
					[
						"todo",
						'<ul data-type="taskList"><li data-checked="true"><p>Test for <code>creme</code></p></li></ul>',
					],
					[
						"todo",
						'<ul data-type="taskList"><li data-checked="false"><p>Match with or without accents</p></li></ul>',
					],
				];
				for (const [index, [type, content]] of blocks.entries())
					yield* Blocks.createBlock({
						pageId,
						type,
						content,
						index,
						parentId: null,
					});
			}
			return { db, rec };
		}),
	);

const url = (dbId: string, recordId: string) =>
	`/api/v1/workspaces/${WORKSPACE}/databases/${dbId}/records/${recordId}`;

describe("a record as markdown over REST", () => {
	test("title, field values, markdown body and criteria in one call, by short id", async () => {
		using api = restWorkspace();
		const { db } = await card(api, true);
		const res = await api.call("GET", url(db.id, "NOT-1"), { key: "read" });
		expect(res.status).toBe(200);
		expect(res.json).toMatchObject({
			shortId: "NOT-1",
			title: "Search ignores accents",
			fields: { Status: "ready-for-agent" },
			criteria: [
				{ text: "Test for `creme`", checked: true },
				{ text: "Match with or without accents", checked: false },
			],
		});
		expect(res.json.body).toContain(
			"Users typing **creme** find & see nothing.",
		);
		expect(res.json.body).toContain("- [x] Test for `creme`");
		expect(res.json.body).toContain("- [ ] Match with or without accents");
		expect(res.json.body).not.toContain("<");
	});

	test("a record never opened as a page has an empty body and no criteria", async () => {
		using api = restWorkspace();
		const { db, rec } = await card(api, false);
		const res = await api.call("GET", url(db.id, rec.id), { key: "read" });
		expect(res.json).toMatchObject({ body: "", criteria: [] });
	});

	test("an unknown record is a 404", async () => {
		using api = restWorkspace();
		const { db } = await card(api, false);
		const res = await api.call("GET", url(db.id, "NOT-9"), { key: "read" });
		expect(res.status).toBe(404);
	});
});

describe("editor HTML as markdown", () => {
	test("a toggle keeps its summary and everything inside it", () => {
		const md = blockToMarkdown(
			"toggle",
			'<details open=""><summary>Why</summary><div data-details-content=""><p>Because.</p><ul><li>one</li><li>two</li></ul></div></details>',
		);
		expect(md).toContain("Why");
		expect(md).toContain("Because.");
		expect(md).toContain("- one\n- two");
	});

	test("nested to-dos are separate criteria, and nest in the body", async () => {
		using api = restWorkspace();
		const { db } = await api.run(
			Effect.gen(function* () {
				const page = yield* Pages.createPage({ title: "P", parentId: null });
				const db = yield* Databases.createDatabase({
					pageId: page.id,
					name: "Notara",
				});
				const rec = yield* Databases.createRecord({
					databaseId: db.id,
					title: "t",
				});
				const { pageId } = yield* Databases.openRecordAsPage(rec.id);
				yield* Blocks.createBlock({
					pageId,
					type: "todo",
					content:
						'<ul data-type="taskList"><li data-checked="false"><p>parent</p><ul data-type="taskList"><li data-checked="true"><p>child</p></li></ul></li></ul>',
					index: 0,
					parentId: null,
				});
				return { db };
			}),
		);
		const res = await api.call("GET", url(db.id, "NOT-1"), { key: "read" });
		expect(res.json.criteria).toEqual([
			{ text: "parent", checked: false },
			{ text: "child", checked: true },
		]);
		expect(res.json.body).toBe("- [ ] parent\n  - [x] child");
	});

	test("text that merely starts with < is not HTML", () => {
		expect(blockToMarkdown("paragraph", "<3 this")).toBe("<3 this");
	});

	test("entities decode once", () => {
		expect(
			blockToMarkdown("paragraph", "<p>a &amp;lt; b &#x27;c&#39;</p>"),
		).toBe("a &lt; b 'c'");
	});
});

test("a record of another database is a 404 here", async () => {
	using api = restWorkspace();
	const { rec } = await card(api, false);
	const other = await api.run(
		Effect.gen(function* () {
			const page = yield* Pages.createPage({ title: "Q", parentId: null });
			return yield* Databases.createDatabase({
				pageId: page.id,
				name: "Other",
			});
		}),
	);
	const res = await api.call("GET", url(other.id, rec.id), { key: "read" });
	expect(res.status).toBe(404);
});
