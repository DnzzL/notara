/**
 * A card in one call (NOT-161): an agent creates or updates a record with its
 * fields named as people name them, its body in markdown and its criteria —
 * and a mistake anywhere writes nothing.
 */
import { describe, expect, test } from "bun:test";
import { Effect } from "effect";
import * as Blocks from "../src/handlers/blocks.js";
import * as Databases from "../src/handlers/databases.js";
import * as Pages from "../src/handlers/pages.js";
import * as Permissions from "../src/handlers/permissions.js";
import { restWorkspace, WORKSPACE } from "./rest-harness.js";

const backlog = (api: ReturnType<typeof restWorkspace>) =>
	api.run(
		Effect.gen(function* () {
			const page = yield* Pages.createPage({ title: "P", parentId: null });
			const db = yield* Databases.createDatabase({
				pageId: page.id,
				name: "Notara",
			});
			const field = (name: string, type: string, options?: string[]) =>
				Databases.createField({
					databaseId: db.id,
					name,
					type,
					options: options ?? null,
					relationTargetDbId: null,
				});
			const status = yield* field("Status", "select", [
				"ready-for-agent",
				"done",
			]);
			yield* field("Labels", "multiSelect", ["bug", "ux"]);
			yield* field("Estimate", "number");
			yield* field("Blocked", "checkbox");
			yield* field("Due", "date");
			return { db, status };
		}),
	);

const records = (dbId: string) =>
	`/api/v1/workspaces/${WORKSPACE}/databases/${dbId}/records`;

describe("creating a card in one call", () => {
	test("title, fields by name or id, markdown body and criteria", async () => {
		using api = restWorkspace();
		const { db, status } = await backlog(api);
		const res = await api.call("POST", records(db.id), {
			key: "write",
			body: {
				title: "Search ignores accents",
				fields: {
					[status.id]: "ready-for-agent",
					Labels: ["bug"],
					Estimate: 3,
					Blocked: false,
				},
				body: "Users typing **creme** find nothing.\n\n- one\n- two",
				criteria: [
					"Match with or without accents",
					{ text: "Test", checked: true },
				],
			},
		});
		expect(res.status).toBe(201);
		expect(res.json).toMatchObject({
			shortId: "NOT-1",
			title: "Search ignores accents",
			fields: {
				Status: "ready-for-agent",
				Labels: ["bug"],
				Estimate: 3,
				Blocked: false,
			},
			criteria: [
				{ text: "Match with or without accents", checked: false },
				{ text: "Test", checked: true },
			],
		});
		expect(res.json.body).toContain("Users typing **creme** find nothing.");
		expect(res.json.body).toContain("- one");
		expect(res.json.body).toContain("- [ ] Match with or without accents");

		const read = await api.call("GET", `${records(db.id)}/NOT-1`, {
			key: "read",
		});
		expect(read.json).toEqual(res.json);
	});

	test("a title alone still makes a card", async () => {
		using api = restWorkspace();
		const { db } = await backlog(api);
		const res = await api.call("POST", records(db.id), {
			key: "write",
			body: { title: "Bare" },
		});
		expect(res.status).toBe(201);
		expect(res.json).toMatchObject({ title: "Bare", body: "", criteria: [] });
	});

	test("an unknown field is named, and no card is made", async () => {
		using api = restWorkspace();
		const { db } = await backlog(api);
		const res = await api.call("POST", records(db.id), {
			key: "write",
			body: { title: "t", fields: { Status: "done", Statut: "done" } },
		});
		expect(res.status).toBe(422);
		expect(res.json.error).toContain('"Statut"');
		const listed = await api.call("GET", records(db.id), { key: "read" });
		expect(listed.json).toEqual([]);
	});

	test("an invalid value is named with its field, and no card is made", async () => {
		using api = restWorkspace();
		const { db } = await backlog(api);
		const bad: Array<[string, unknown, string]> = [
			["Status", "redy-for-agent", '"redy-for-agent"'],
			["Labels", ["bug", "nope"], '"nope"'],
			["Labels", "bug", "Labels"],
			["Estimate", "three", "Estimate"],
			["Blocked", "yes", "Blocked"],
			["Due", "next tuesday", "Due"],
		];
		for (const [field, value, named] of bad) {
			const res = await api.call("POST", records(db.id), {
				key: "write",
				body: { title: "t", fields: { [field]: value } },
			});
			expect([field, res.status]).toEqual([field, 422]);
			expect(res.json.error).toContain(named);
		}
		const listed = await api.call("GET", records(db.id), { key: "read" });
		expect(listed.json).toEqual([]);
	});
});

describe("updating a card's fields in one call", () => {
	test("several fields by name, the others untouched", async () => {
		using api = restWorkspace();
		const { db } = await backlog(api);
		await api.call("POST", records(db.id), {
			key: "write",
			body: { title: "t", fields: { Estimate: 1, Labels: ["ux"] } },
		});
		const res = await api.call("PATCH", `${records(db.id)}/NOT-1`, {
			key: "write",
			body: { fields: { Status: "done", Estimate: 5 } },
		});
		expect(res.status).toBe(200);
		expect(res.json.fields).toEqual({
			Status: "done",
			Estimate: 5,
			Labels: ["ux"],
		});
	});

	test("one bad value writes none of them", async () => {
		using api = restWorkspace();
		const { db } = await backlog(api);
		await api.call("POST", records(db.id), {
			key: "write",
			body: { title: "t", fields: { Status: "ready-for-agent" } },
		});
		const res = await api.call("PATCH", `${records(db.id)}/NOT-1`, {
			key: "write",
			body: { title: "renamed", fields: { Status: "done", Estimate: "x" } },
		});
		expect(res.status).toBe(422);
		const read = await api.call("GET", `${records(db.id)}/NOT-1`, {
			key: "read",
		});
		expect(read.json).toMatchObject({
			title: "t",
			fields: { Status: "ready-for-agent" },
		});
	});

	test("a read key cannot write a card", async () => {
		using api = restWorkspace();
		const { db } = await backlog(api);
		const res = await api.call("POST", records(db.id), {
			key: "read",
			body: { title: "t" },
		});
		expect(res.status).toBe(403);
	});
});

describe("adding criteria to a card that exists", () => {
	const criteriaOf = (dbId: string) => `${records(dbId)}/NOT-1/criteria`;

	test("appended after the ones it has, under the one heading", async () => {
		using api = restWorkspace();
		const { db } = await backlog(api);
		await api.call("POST", records(db.id), {
			key: "write",
			body: { title: "t", body: "Why.", criteria: ["first"] },
		});
		const res = await api.call("POST", criteriaOf(db.id), {
			key: "write",
			body: { criteria: ["second", { text: "third", checked: true }] },
		});
		expect(res.status).toBe(201);
		expect(res.json.criteria).toMatchObject([
			{ text: "first", checked: false },
			{ text: "second", checked: false },
			{ text: "third", checked: true },
		]);
		expect(res.json.body.match(/Acceptance Criteria/g)).toHaveLength(1);
		expect(res.json.body.indexOf("Why.")).toBeLessThan(
			res.json.body.indexOf("second"),
		);
	});

	test("a card with no page gets one, with the heading", async () => {
		using api = restWorkspace();
		const { db } = await backlog(api);
		await api.call("POST", records(db.id), {
			key: "write",
			body: { title: "Bare" },
		});
		const res = await api.call("POST", criteriaOf(db.id), {
			key: "write",
			body: { criteria: ["compiles"] },
		});
		expect(res.status).toBe(201);
		expect(res.json.criteria).toMatchObject([
			{ text: "compiles", checked: false },
		]);
		expect(res.json.body).toContain("Acceptance Criteria");
	});

	test("no criteria, or a malformed one, writes nothing", async () => {
		using api = restWorkspace();
		const { db } = await backlog(api);
		await api.call("POST", records(db.id), {
			key: "write",
			body: { title: "t" },
		});
		for (const criteria of [[], undefined, ["ok", 3]]) {
			const res = await api.call("POST", criteriaOf(db.id), {
				key: "write",
				body: { criteria },
			});
			expect(res.status).toBe(422);
		}
		const read = await api.call("GET", `${records(db.id)}/NOT-1`, {
			key: "read",
		});
		expect(read.json).toMatchObject({ body: "", criteria: [] });
	});

	test("a read key cannot add criteria", async () => {
		using api = restWorkspace();
		const { db } = await backlog(api);
		await api.call("POST", records(db.id), {
			key: "write",
			body: { title: "t" },
		});
		const res = await api.call("POST", criteriaOf(db.id), {
			key: "read",
			body: { criteria: ["x"] },
		});
		expect(res.status).toBe(403);
	});
});

describe("a markdown body as the editor shows it", () => {
	const create = async (body: string) => {
		using api = restWorkspace();
		const { db } = await backlog(api);
		const res = await api.call("POST", records(db.id), {
			key: "write",
			body: { title: "t", body },
		});
		const { pageId } = await api.run(Databases.openRecordAsPage(res.json.id));
		const blocks = await api.run(Blocks.listBlocks(pageId));
		return { json: res.json, html: blocks.map((b) => b.content).join("") };
	};

	test("bold, italic, code and links are formatted, not shown as symbols", async () => {
		const { html } = await create(
			"Users typing **creme** in `search` find _nothing_, see [the spec](https://x.test/a).",
		);
		expect(html).toContain("<strong>creme</strong>");
		expect(html).toContain("<code>search</code>");
		expect(html).toContain("<em>nothing</em>");
		expect(html).toContain('<a href="https://x.test/a">the spec</a>');
	});

	test("a link that is not http(s) stays text", async () => {
		const { html } = await create("[click](javascript:alert(1))");
		expect(html).not.toContain("<a");
	});

	test("HTML in the markdown is text", async () => {
		const { html } = await create("<img src=x onerror=alert(1)>");
		expect(html).not.toContain("<img");
	});

	test("a ticked item in the body stays ticked", async () => {
		const { json } = await create("- [x] done already\n- [ ] still open");
		expect(json.criteria).toMatchObject([
			{ text: "done already", checked: true },
			{ text: "still open", checked: false },
		]);
	});

	test("a leading # heading is kept", async () => {
		const { json } = await create("# Context\n\nWhy.");
		expect(json.body).toContain("# Context");
	});
});

test("a route names a database bob can edit, and a card of one locked away from him", async () => {
	using api = restWorkspace();
	const { open, locked } = await api.run(
		Effect.gen(function* () {
			const make = (title: string) =>
				Effect.gen(function* () {
					const page = yield* Pages.createPage({ title, parentId: null });
					const db = yield* Databases.createDatabase({
						pageId: page.id,
						name: title,
					});
					const rec = yield* Databases.createRecord({
						databaseId: db.id,
						title: "r",
					});
					const field = yield* Databases.createField({
						databaseId: db.id,
						name: "Status",
						type: "text",
						options: null,
						relationTargetDbId: null,
					});
					return { page: page.id, db: db.id, rec: rec.id, field: field.id };
				});
			const open = yield* make("Open");
			const locked = yield* make("Locked");
			yield* Permissions.writePagePermissions({
				pageId: locked.page,
				set: [{ subject: { type: "user", id: "ann" }, relation: "owner" }],
				remove: [],
			});
			return { open, locked };
		}),
	);
	const base = `${records(open.db)}/${locked.rec}`;
	const tries = [
		await api.call("PATCH", base, { key: "bob", body: { title: "owned" } }),
		await api.call("PUT", `${base}/fields/${locked.field}`, {
			key: "bob",
			body: { value: "owned" },
		}),
		await api.call(
			"PUT",
			`${records(open.db)}/${open.rec}/fields/${locked.field}`,
			{
				key: "bob",
				body: { value: "owned" },
			},
		),
		await api.call("DELETE", base, { key: "bob" }),
		await api.call(
			"PATCH",
			`/api/v1/workspaces/${WORKSPACE}/databases/${open.db}/fields/${locked.field}`,
			{ key: "bob", body: { name: "owned" } },
		),
	];
	expect(tries.map((r) => r.status)).toEqual([404, 404, 404, 404, 404]);
	const card = await api.call("GET", `${records(locked.db)}/${locked.rec}`, {
		key: "write",
	});
	expect(card.json.title).toBe("r");
});

test("a card's page says which card it is; other pages say none", async () => {
	using api = restWorkspace();
	const { db } = await backlog(api);
	const res = await api.call("POST", records(db.id), {
		key: "write",
		body: { title: "t" },
	});
	const { pageId } = await api.run(Databases.openRecordAsPage(res.json.id));
	const pages = await api.run(Pages.listPages);
	expect(pages.find((p) => p.id === pageId)?.recordId).toBe(res.json.id);
	expect(pages.filter((p) => p.id !== pageId).map((p) => p.recordId)).toEqual([
		null,
	]);
	expect((await api.run(Pages.getPage(pageId))).recordId).toBe(res.json.id);
});
