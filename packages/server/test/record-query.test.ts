/**
 * The record query over REST (NOT-175): `filter=field:operator:value`, repeated
 * and ANDed, with `field` named by id or by name and `operator` taken from the
 * field type's registry. The operator set is the one the app's query bar offers,
 * because it is now one evaluator in @notara/shared rather than two.
 *
 * The bare `field`/`value` equality path stays, byte-identical, beside it.
 */
import { describe, expect, test } from "bun:test";
import { Effect } from "effect";
import * as Databases from "../src/handlers/databases.js";
import * as Pages from "../src/handlers/pages.js";
import { restWorkspace, WORKSPACE } from "./rest-harness.js";

const url = (dbId: string, query: string) =>
	`/api/v1/workspaces/${WORKSPACE}/databases/${dbId}/records${query}`;

const titles = (json: Array<{ title: string }>) =>
	json.map((r) => r.title).sort();

/** Three cards over Status (select), Points (number), Due (date). */
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
			const points = yield* Databases.createField({
				databaseId: db.id,
				name: "Points",
				type: "number",
				options: null,
				relationTargetDbId: null,
			});
			const due = yield* Databases.createField({
				databaseId: db.id,
				name: "Due",
				type: "date",
				options: null,
				relationTargetDbId: null,
			});
			for (const [title, s, p, d] of [
				["a", "ready-for-agent", "1", "2026-01-05"],
				["b", "ready-for-agent", "5", "2026-03-03"],
				["c", "done", "10", "2026-06-01"],
			] as const) {
				const r = yield* Databases.createRecord({ databaseId: db.id, title });
				yield* Databases.updateFieldValue({
					recordId: r.id,
					fieldId: status.id,
					value: s,
				});
				yield* Databases.updateFieldValue({
					recordId: r.id,
					fieldId: points.id,
					value: p,
				});
				yield* Databases.updateFieldValue({
					recordId: r.id,
					fieldId: due.id,
					value: d,
				});
			}
			return { db, status };
		}),
	);

describe("operator filters over REST", () => {
	test("is_not keeps everything the value is not", async () => {
		using api = restWorkspace();
		const { db } = await board(api);
		const res = await api.call(
			"GET",
			url(db.id, "?filter=Status:is_not:done"),
			{
				key: "read",
			},
		);
		expect(res.status).toBe(200);
		expect(titles(res.json)).toEqual(["a", "b"]);
	});

	test("a numeric field compares numerically, not as text", async () => {
		using api = restWorkspace();
		const { db } = await board(api);
		const gt = await api.call("GET", url(db.id, "?filter=Points:gt:4"), {
			key: "read",
		});
		expect(titles(gt.json)).toEqual(["b", "c"]);
		const lte = await api.call("GET", url(db.id, "?filter=Points:lte:5"), {
			key: "read",
		});
		expect(titles(lte.json)).toEqual(["a", "b"]);
	});

	test("a date field understands before and after", async () => {
		using api = restWorkspace();
		const { db } = await board(api);
		const before = await api.call(
			"GET",
			url(db.id, "?filter=Due:before:2026-02-01"),
			{ key: "read" },
		);
		expect(titles(before.json)).toEqual(["a"]);
		const after = await api.call(
			"GET",
			url(db.id, "?filter=Due:after:2026-02-01"),
			{ key: "read" },
		);
		expect(titles(after.json)).toEqual(["b", "c"]);
	});

	test("a filter names its field by id as well as by name", async () => {
		using api = restWorkspace();
		const { db, status } = await board(api);
		const res = await api.call(
			"GET",
			url(db.id, `?filter=${status.id}:is:done`),
			{ key: "read" },
		);
		expect(titles(res.json)).toEqual(["c"]);
	});

	test("several filters combine with AND", async () => {
		using api = restWorkspace();
		const { db } = await board(api);
		const res = await api.call(
			"GET",
			url(db.id, "?filter=Status:is:ready-for-agent&filter=Points:gt:4"),
			{ key: "read" },
		);
		expect(titles(res.json)).toEqual(["b"]);
	});

	test("no new param is today's bare array", async () => {
		using api = restWorkspace();
		const { db } = await board(api);
		const res = await api.call("GET", url(db.id, ""), { key: "read" });
		expect(Array.isArray(res.json)).toBe(true);
		expect(titles(res.json)).toEqual(["a", "b", "c"]);
	});

	test("the legacy field=value pair is unchanged beside it", async () => {
		using api = restWorkspace();
		const { db } = await board(api);
		const res = await api.call(
			"GET",
			url(db.id, "?field=Status&value=ready-for-agent"),
			{ key: "read" },
		);
		expect(titles(res.json)).toEqual(["a", "b"]);
	});
});

describe("operator filters refuse what they cannot run", () => {
	test("an unknown field is a 400 that names it", async () => {
		using api = restWorkspace();
		const { db } = await board(api);
		const res = await api.call("GET", url(db.id, "?filter=Owner:is:x"), {
			key: "read",
		});
		expect(res.status).toBe(400);
		expect(res.json.error).toContain("Owner");
	});

	test("an operator the field type does not offer is a 400 naming it", async () => {
		using api = restWorkspace();
		const { db } = await board(api);
		const res = await api.call("GET", url(db.id, "?filter=Status:gt:x"), {
			key: "read",
		});
		expect(res.status).toBe(400);
		expect(res.json.error).toContain("gt");
		expect(res.json.error).toContain("select");
	});

	test("a filter that is not field:operator:value is a 400", async () => {
		using api = restWorkspace();
		const { db } = await board(api);
		const res = await api.call("GET", url(db.id, "?filter=Status"), {
			key: "read",
		});
		expect(res.status).toBe(400);
	});
});
