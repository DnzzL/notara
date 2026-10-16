/**
 * Search inside a query (NOT-178): `q=text` on the records route narrows the
 * records the caller would otherwise get, over their field values and the
 * content of each record's own page.
 *
 * The load-bearing part is *where* the search runs: before `limit`/`offset`.
 * A search applied to an already-paged window silently misses matches on later
 * pages — the bug this file exists to catch. The window is taken after
 * filtering, searching and sorting, so one call finds a match that would sit
 * on a later page.
 *
 * Driven through the REST route, like every change to a seam.
 */
import { describe, expect, test } from "bun:test";
import { Effect } from "effect";
import * as Blocks from "../src/handlers/blocks.js";
import * as Databases from "../src/handlers/databases.js";
import * as Pages from "../src/handlers/pages.js";
import { restWorkspace, WORKSPACE } from "./rest-harness.js";

const recordsUrl = (dbId: string, query: string) =>
	`/api/v1/workspaces/${WORKSPACE}/databases/${dbId}/records${query}`;

const titles = (json: Array<{ title: string }>) => json.map((r) => r.title);

/**
 * Six cards, created in title order:
 *  - field values (Status select, Notes text) on every one;
 *  - a page body on the last, so a match on a record's page content has
 *    something to hit.
 *
 * The "zanzibar" match sits on the fifth card, so a window taken before the
 * search (a `limit=1` page 1 is "a") would miss it.
 */
const board = (api: ReturnType<typeof restWorkspace>) =>
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
				options: ["ready-for-agent", "done"],
				relationTargetDbId: null,
			});
			const notes = yield* Databases.createField({
				databaseId: db.id,
				name: "Notes",
				type: "text",
				options: null,
				relationTargetDbId: null,
			});
			for (const [title, s, n] of [
				["a", "ready-for-agent", "alpha"],
				["b", "ready-for-agent", "beta"],
				["c", "done", "gamma"],
				["d", "ready-for-agent", "delta"],
				["e", "ready-for-agent", "zanzibar"],
				["f", "done", "phi"],
			] as const) {
				const r = yield* Databases.createRecord({ databaseId: db.id, title });
				yield* Databases.updateFieldValue({
					recordId: r.id,
					fieldId: status.id,
					value: s,
				});
				yield* Databases.updateFieldValue({
					recordId: r.id,
					fieldId: notes.id,
					value: n,
				});
			}
			// The last card's own page holds a body the search must read.
			const f = yield* Databases.listRecords(db.id);
			const last = f[f.length - 1];
			const { pageId } = yield* Databases.openRecordAsPage(last.id);
			yield* Blocks.createBlock({
				pageId,
				type: "paragraph",
				content: "<p>the quokka appears at dusk</p>",
				index: 0,
				parentId: null,
			});
			return { db, status, notes };
		}),
	);

describe("q narrows a query by text", () => {
	test("q matches a record's field value", async () => {
		using api = restWorkspace();
		const { db } = await board(api);
		const res = await api.call("GET", recordsUrl(db.id, "?q=zanzibar"), {
			key: "read",
		});
		expect(res.status).toBe(200);
		expect(titles(res.json)).toEqual(["e"]);
	});

	test("q matches a record's page content", async () => {
		using api = restWorkspace();
		const { db } = await board(api);
		const res = await api.call("GET", recordsUrl(db.id, "?q=quokka"), {
			key: "read",
		});
		expect(res.status).toBe(200);
		expect(titles(res.json)).toEqual(["f"]);
	});

	test("matching ignores case", async () => {
		using api = restWorkspace();
		const { db } = await board(api);
		const field = await api.call("GET", recordsUrl(db.id, "?q=ZaNzIbAr"), {
			key: "read",
		});
		expect(titles(field.json)).toEqual(["e"]);
		const page = await api.call("GET", recordsUrl(db.id, "?q=QUOKKA"), {
			key: "read",
		});
		expect(titles(page.json)).toEqual(["f"]);
	});

	test("q combines with filter=: both must hold", async () => {
		using api = restWorkspace();
		const { db } = await board(api);
		const both = await api.call(
			"GET",
			recordsUrl(db.id, "?filter=Status:is:ready-for-agent&q=zanzibar"),
			{ key: "read" },
		);
		expect(titles(both.json)).toEqual(["e"]);
		const excludedByFilter = await api.call(
			"GET",
			recordsUrl(db.id, "?filter=Status:is:done&q=zanzibar"),
			{ key: "read" },
		);
		expect(titles(excludedByFilter.json)).toEqual([]);
	});

	test("q combines with field/value equality", async () => {
		using api = restWorkspace();
		const { db } = await board(api);
		const res = await api.call(
			"GET",
			recordsUrl(db.id, "?field=Status&value=ready-for-agent&q=alpha"),
			{ key: "read" },
		);
		expect(titles(res.json)).toEqual(["a"]);
	});

	test("q combines with view=", async () => {
		using api = restWorkspace();
		const { db, status } = await board(api);
		await api.run(
			Databases.createView({
				databaseId: db.id,
				name: "Ready",
				type: "table",
				groupByFieldId: null,
				config: JSON.stringify({
					filters: [
						{ fieldId: status.id, operator: "is", value: "ready-for-agent" },
					],
					sorts: [],
					boardHidden: [],
				}),
			}),
		);
		const narrowed = await api.call(
			"GET",
			recordsUrl(db.id, "?view=Ready&q=zanzibar"),
			{ key: "read" },
		);
		expect(titles(narrowed.json)).toEqual(["e"]);
		// "gamma" is done, so the view's filter and the search cannot both hold.
		const excludedByView = await api.call(
			"GET",
			recordsUrl(db.id, "?view=Ready&q=gamma"),
			{ key: "read" },
		);
		expect(titles(excludedByView.json)).toEqual([]);
	});

	test("an absent q changes nothing", async () => {
		using api = restWorkspace();
		const { db } = await board(api);
		const bare = await api.call("GET", recordsUrl(db.id, ""), { key: "read" });
		const absent = await api.call("GET", recordsUrl(db.id, "?"), {
			key: "read",
		});
		expect(absent.json).toEqual(bare.json);
	});

	test("an empty q changes nothing", async () => {
		using api = restWorkspace();
		const { db } = await board(api);
		const bare = await api.call("GET", recordsUrl(db.id, ""), { key: "read" });
		const empty = await api.call("GET", recordsUrl(db.id, "?q="), {
			key: "read",
		});
		expect(empty.json).toEqual(bare.json);
	});
});

describe("q is applied before the window", () => {
	test("a match past the first page is found with a small limit", async () => {
		using api = restWorkspace();
		const { db } = await board(api);
		// "zanzibar" is on the fifth card; with limit=1 the naive page 1 is "a".
		const res = await api.call(
			"GET",
			recordsUrl(db.id, "?q=zanzibar&limit=1"),
			{
				key: "read",
			},
		);
		expect(res.status).toBe(200);
		expect(titles(res.json.records)).toEqual(["e"]);
		expect(res.json.nextCursor).toBeNull();
	});

	test("q combines with limit and view", async () => {
		using api = restWorkspace();
		const { db, status } = await board(api);
		await api.run(
			Databases.createView({
				databaseId: db.id,
				name: "Ready",
				type: "table",
				groupByFieldId: null,
				config: JSON.stringify({
					filters: [
						{ fieldId: status.id, operator: "is", value: "ready-for-agent" },
					],
					sorts: [],
					boardHidden: [],
				}),
			}),
		);
		const res = await api.call(
			"GET",
			recordsUrl(db.id, "?view=Ready&q=zanzibar&limit=1"),
			{ key: "read" },
		);
		expect(res.status).toBe(200);
		expect(titles(res.json.records)).toEqual(["e"]);
		expect(res.json.nextCursor).toBeNull();
	});
});

describe("a q the server refuses", () => {
	test("a q above the ceiling is refused, never truncated", async () => {
		using api = restWorkspace();
		const { db } = await board(api);
		const res = await api.call(
			"GET",
			recordsUrl(db.id, `?q=${"x".repeat(1001)}`),
			{ key: "read" },
		);
		expect(res.status).toBe(400);
		expect(res.json.error).toContain("q");
		expect(res.json.error).toContain("1000");
	});
});
