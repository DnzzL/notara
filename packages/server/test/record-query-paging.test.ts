/**
 * Bounded responses over REST (NOT-177): `limit` (with optional `offset`)
 * selects a window and the response carries `nextCursor` to continue it.
 *
 * Additive, and that is the load-bearing part: a caller that sends no `limit`
 * gets today's bare array, byte for byte — the published CLI sends none.
 *
 * The window is taken after filtering, searching and sorting, so walking
 * `nextCursor` yields every record exactly once. A window taken before the sort
 * would overlap or miss rows, which is the bug this file exists to catch.
 */
import { describe, expect, test } from "bun:test";
import { Effect } from "effect";
import * as Databases from "../src/handlers/databases.js";
import * as Pages from "../src/handlers/pages.js";
import { restWorkspace, WORKSPACE } from "./rest-harness.js";

const recordsUrl = (dbId: string, query: string) =>
	`/api/v1/workspaces/${WORKSPACE}/databases/${dbId}/records${query}`;

const titles = (json: Array<{ title: string }>) => json.map((r) => r.title);

/** Five cards over Status (select) and Points (number), created in title order. */
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
			for (const [title, s, p] of [
				["a", "ready-for-agent", "1"],
				["b", "ready-for-agent", "5"],
				["c", "done", "10"],
				["d", "ready-for-agent", "2"],
				["e", "done", "7"],
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
			}
			return { db, status, points };
		}),
	);

/** Walk `limit`-sized windows by handing each `nextCursor` back as `offset`. */
const walk = async (
	api: ReturnType<typeof restWorkspace>,
	dbId: string,
	query: string,
) => {
	const seen: Array<{ title: string }> = [];
	let cursor: string | null = null;
	for (let page = 0; page < 20; page++) {
		const q = cursor === null ? query : `${query}&offset=${cursor}`;
		const res: { status: number; json: any } = await api.call(
			"GET",
			recordsUrl(dbId, q),
			{ key: "read" },
		);
		expect(res.status).toBe(200);
		seen.push(...res.json.records);
		cursor = res.json.nextCursor;
		if (cursor === null) return seen;
	}
	throw new Error("nextCursor never reached the end");
};

describe("a caller that sends no limit", () => {
	test("gets today's bare array, not an envelope", async () => {
		using api = restWorkspace();
		const { db } = await board(api);
		const res = await api.call("GET", recordsUrl(db.id, ""), { key: "read" });
		expect(res.status).toBe(200);
		expect(Array.isArray(res.json)).toBe(true);
		expect(titles(res.json)).toEqual(["a", "b", "c", "d", "e"]);
		expect(res.json[0]).toEqual(
			expect.objectContaining({
				id: expect.any(String),
				databaseId: db.id,
				title: "a",
				fields: expect.objectContaining({ Status: "ready-for-agent" }),
			}),
		);
	});

	test("is unaffected by limit= on the same database", async () => {
		using api = restWorkspace();
		const { db } = await board(api);
		const bare = await api.call("GET", recordsUrl(db.id, ""), { key: "read" });
		const bounded = await api.call("GET", recordsUrl(db.id, "?limit=50"), {
			key: "read",
		});
		expect(bounded.json.records).toEqual(bare.json);
	});
});

describe("a bounded window", () => {
	test("limit= wraps the records in {records, nextCursor}", async () => {
		using api = restWorkspace();
		const { db } = await board(api);
		const res = await api.call("GET", recordsUrl(db.id, "?limit=2"), {
			key: "read",
		});
		expect(res.status).toBe(200);
		expect(Array.isArray(res.json)).toBe(false);
		expect(titles(res.json.records)).toEqual(["a", "b"]);
		expect(typeof res.json.nextCursor).toBe("string");
	});

	test("walking nextCursor yields every record exactly once, no gap, no repeat", async () => {
		using api = restWorkspace();
		const { db } = await board(api);
		const seen = await walk(api, db.id, "?limit=2");
		expect(titles(seen)).toEqual(["a", "b", "c", "d", "e"]);
		expect(new Set(titles(seen)).size).toBe(seen.length);
	});

	test("a one-record window walks the same list", async () => {
		using api = restWorkspace();
		const { db } = await board(api);
		const seen = await walk(api, db.id, "?limit=1");
		expect(titles(seen)).toEqual(["a", "b", "c", "d", "e"]);
	});

	test("nextCursor is null on the window that reaches the end", async () => {
		using api = restWorkspace();
		const { db } = await board(api);
		const res = await api.call("GET", recordsUrl(db.id, "?limit=2&offset=4"), {
			key: "read",
		});
		expect(res.status).toBe(200);
		expect(titles(res.json.records)).toEqual(["e"]);
		expect(res.json.nextCursor).toBeNull();
	});

	test("a limit larger than the record count returns everything, and says so", async () => {
		using api = restWorkspace();
		const { db } = await board(api);
		const res = await api.call("GET", recordsUrl(db.id, "?limit=50"), {
			key: "read",
		});
		expect(res.status).toBe(200);
		expect(titles(res.json.records)).toEqual(["a", "b", "c", "d", "e"]);
		expect(res.json.nextCursor).toBeNull();
	});

	test("offset picks where the window starts", async () => {
		using api = restWorkspace();
		const { db } = await board(api);
		const res = await api.call("GET", recordsUrl(db.id, "?limit=2&offset=2"), {
			key: "read",
		});
		expect(res.status).toBe(200);
		expect(titles(res.json.records)).toEqual(["c", "d"]);
		expect(typeof res.json.nextCursor).toBe("string");
	});

	test("two identical requests return the same window", async () => {
		using api = restWorkspace();
		const { db } = await board(api);
		const first = await api.call(
			"GET",
			recordsUrl(db.id, "?limit=2&offset=2"),
			{
				key: "read",
			},
		);
		const second = await api.call(
			"GET",
			recordsUrl(db.id, "?limit=2&offset=2"),
			{ key: "read" },
		);
		expect(second.json).toEqual(first.json);
		expect(titles(second.json.records)).toEqual(["c", "d"]);
	});
});

describe("a window is taken after filtering and sorting", () => {
	test("a window of one on a sorted view is the first row the sort wants", async () => {
		using api = restWorkspace();
		const { db, points } = await board(api);
		await api.run(
			Databases.createView({
				databaseId: db.id,
				name: "By Points",
				type: "table",
				groupByFieldId: null,
				config: JSON.stringify({
					filters: [],
					sorts: [{ fieldId: points.id, direction: "desc" }],
					boardHidden: [],
				}),
			}),
		);
		const first = await api.call(
			"GET",
			recordsUrl(db.id, "?view=By Points&limit=1"),
			{ key: "read" },
		);
		expect(first.status).toBe(200);
		expect(titles(first.json.records)).toEqual(["c"]);
		// And the whole walk is the view's order, not the creation order.
		expect(titles(await walk(api, db.id, "?view=By Points&limit=2"))).toEqual([
			"c",
			"e",
			"b",
			"d",
			"a",
		]);
	});

	test("limit combines with filter=", async () => {
		using api = restWorkspace();
		const { db } = await board(api);
		const res = await api.call(
			"GET",
			recordsUrl(db.id, "?filter=Status:is:ready-for-agent&limit=2"),
			{ key: "read" },
		);
		expect(res.status).toBe(200);
		expect(titles(res.json.records)).toEqual(["a", "b"]);
		expect(
			titles(
				await walk(api, db.id, "?filter=Status:is:ready-for-agent&limit=2"),
			),
		).toEqual(["a", "b", "d"]);
	});

	test("limit combines with view= and filter= both", async () => {
		using api = restWorkspace();
		const { db, status, points } = await board(api);
		await api.run(
			Databases.createView({
				databaseId: db.id,
				name: "Done",
				type: "table",
				groupByFieldId: null,
				config: JSON.stringify({
					filters: [{ fieldId: status.id, operator: "is", value: "done" }],
					sorts: [{ fieldId: points.id, direction: "desc" }],
					boardHidden: [],
				}),
			}),
		);
		expect(
			titles(await walk(api, db.id, "?view=Done&filter=Points:gt:6&limit=1")),
		).toEqual(["c", "e"]);
	});
});

describe("a limit or offset the server refuses", () => {
	const refused = async (
		api: ReturnType<typeof restWorkspace>,
		dbId: string,
		query: string,
	) => {
		const res = await api.call("GET", recordsUrl(dbId, query), {
			key: "read",
		});
		expect(res.status).toBe(400);
		return res.json.error as string;
	};

	test("limit=0 is not a positive integer", async () => {
		using api = restWorkspace();
		const { db } = await board(api);
		const error = await refused(api, db.id, "?limit=0");
		expect(error).toContain("limit");
	});

	test("limit=abc is not an integer", async () => {
		using api = restWorkspace();
		const { db } = await board(api);
		expect(await refused(api, db.id, "?limit=abc")).toContain("limit");
	});

	test("a limit above the ceiling is refused, never clamped", async () => {
		using api = restWorkspace();
		const { db } = await board(api);
		const error = await refused(api, db.id, "?limit=100000");
		expect(error).toContain("limit");
		expect(error).toContain("1000");
	});

	test("a negative offset is refused", async () => {
		using api = restWorkspace();
		const { db } = await board(api);
		const error = await refused(api, db.id, "?limit=2&offset=-1");
		expect(error).toContain("offset");
	});

	test("an offset that is not an integer is refused", async () => {
		using api = restWorkspace();
		const { db } = await board(api);
		expect(await refused(api, db.id, "?limit=2&offset=two")).toContain(
			"offset",
		);
	});

	test("an offset with no limit is refused", async () => {
		using api = restWorkspace();
		const { db } = await board(api);
		expect(await refused(api, db.id, "?offset=1")).toContain("offset");
	});
});
