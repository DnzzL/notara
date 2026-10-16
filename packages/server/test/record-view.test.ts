/**
 * Views over the API (NOT-176): a saved view is addressable by name or by id,
 * its records and their order come from the evaluator NOT-175 built, and its
 * `fieldId`-keyed filters read the right cell even when two fields of one
 * database share a name — the one case a name-keyed `values` map gets wrong.
 *
 * Driven through the REST route, like every change to a seam.
 */
import { describe, expect, test } from "bun:test";
import { Effect } from "effect";
import * as Databases from "../src/handlers/databases.js";
import * as Pages from "../src/handlers/pages.js";
import { restWorkspace, WORKSPACE } from "./rest-harness.js";

const viewsUrl = (dbId: string) =>
	`/api/v1/workspaces/${WORKSPACE}/databases/${dbId}/views`;
const recordsUrl = (dbId: string, query: string) =>
	`/api/v1/workspaces/${WORKSPACE}/databases/${dbId}/records${query}`;

const titles = (json: Array<{ title: string }>) => json.map((r) => r.title);

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
			return { db, status, points, due };
		}),
	);

describe("a database's views over REST", () => {
	test("the views route lists the database's views", async () => {
		using api = restWorkspace();
		const { db } = await board(api);
		await api.run(
			Databases.createView({
				databaseId: db.id,
				name: "Ready",
				type: "table",
				groupByFieldId: null,
				config: "{}",
			}),
		);
		const res = await api.call("GET", viewsUrl(db.id), { key: "read" });
		expect(res.status).toBe(200);
		expect(res.json.map((v: { name: string }) => v.name).sort()).toEqual([
			"Grid",
			"Ready",
		]);
		expect(res.json.find((v: { name: string }) => v.name === "Ready")).toEqual(
			expect.objectContaining({
				type: "table",
				config: "{}",
				isDefault: false,
			}),
		);
		expect(
			res.json.find((v: { name: string }) => v.name === "Grid").isDefault,
		).toBe(true);
	});

	test("a database with every view deleted lists an empty array, and records still read", async () => {
		using api = restWorkspace();
		const { db } = await board(api);
		await api.run(
			Effect.gen(function* () {
				const views = yield* Databases.listViews(db.id);
				for (const v of views) yield* Databases.deleteView(v.id);
			}),
		);
		const views = await api.call("GET", viewsUrl(db.id), { key: "read" });
		expect(views.status).toBe(200);
		expect(views.json).toEqual([]);
		const records = await api.call("GET", recordsUrl(db.id, ""), {
			key: "read",
		});
		expect(titles(records.json)).toEqual(["a", "b", "c"]);
	});

	test("view=<name> returns exactly that view's records", async () => {
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
		const res = await api.call("GET", recordsUrl(db.id, "?view=Ready"), {
			key: "read",
		});
		expect(res.status).toBe(200);
		expect(titles(res.json)).toEqual(["a", "b"]);
	});

	test("view=<id> returns the same records", async () => {
		using api = restWorkspace();
		const { db, status } = await board(api);
		const view = await api.run(
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
		const res = await api.call("GET", recordsUrl(db.id, `?view=${view.id}`), {
			key: "read",
		});
		expect(res.status).toBe(200);
		expect(titles(res.json)).toEqual(["a", "b"]);
	});

	test("a case-variant name resolves", async () => {
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
		const res = await api.call("GET", recordsUrl(db.id, "?view=rEaDy"), {
			key: "read",
		});
		expect(res.status).toBe(200);
		expect(titles(res.json)).toEqual(["a", "b"]);
	});

	test("an unknown view is refused, naming it", async () => {
		using api = restWorkspace();
		const { db } = await board(api);
		const res = await api.call("GET", recordsUrl(db.id, "?view=nope"), {
			key: "read",
		});
		expect(res.status).toBe(404);
		expect(res.json.error).toContain("nope");
	});

	test("an ambiguous name is refused, naming the candidates", async () => {
		using api = restWorkspace();
		const { db } = await board(api);
		await api.run(
			Effect.gen(function* () {
				yield* Databases.createView({
					databaseId: db.id,
					name: "Ready",
					type: "table",
					groupByFieldId: null,
					config: "{}",
				});
				yield* Databases.createView({
					databaseId: db.id,
					name: "READY",
					type: "table",
					groupByFieldId: null,
					config: "{}",
				});
			}),
		);
		const res = await api.call("GET", recordsUrl(db.id, "?view=ready"), {
			key: "read",
		});
		expect(res.status).toBe(409);
		expect(res.json.error).toContain("Ready");
		expect(res.json.error).toContain("READY");
	});

	test("a view with no config shows every record", async () => {
		using api = restWorkspace();
		const { db } = await board(api);
		await api.run(
			Databases.createView({
				databaseId: db.id,
				name: "All",
				type: "table",
				groupByFieldId: null,
			}),
		);
		const res = await api.call("GET", recordsUrl(db.id, "?view=All"), {
			key: "read",
		});
		expect(res.status).toBe(200);
		expect(titles(res.json)).toEqual(["a", "b", "c"]);
	});

	test("view combines with filter=, ANDed", async () => {
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
			recordsUrl(db.id, "?view=Ready&filter=Points:gt:4"),
			{ key: "read" },
		);
		expect(res.status).toBe(200);
		expect(titles(res.json)).toEqual(["b"]);
	});
});

describe("a view's stored cells and order", () => {
	/** Two fields both named "Flag"; a filter by id must read the right one. */
	const sameNamed = (api: ReturnType<typeof restWorkspace>) =>
		api.run(
			Effect.gen(function* () {
				const page = yield* Pages.createPage({ title: "Dup", parentId: null });
				const db = yield* Databases.createDatabase({
					pageId: page.id,
					name: "Dup DB",
				});
				const flagA = yield* Databases.createField({
					databaseId: db.id,
					name: "Flag",
					type: "text",
					options: null,
					relationTargetDbId: null,
				});
				const flagB = yield* Databases.createField({
					databaseId: db.id,
					name: "Flag",
					type: "text",
					options: null,
					relationTargetDbId: null,
				});
				const first = yield* Databases.createRecord({
					databaseId: db.id,
					title: "first",
				});
				const second = yield* Databases.createRecord({
					databaseId: db.id,
					title: "second",
				});
				yield* Databases.updateFieldValue({
					recordId: first.id,
					fieldId: flagA.id,
					value: "yes",
				});
				yield* Databases.updateFieldValue({
					recordId: first.id,
					fieldId: flagB.id,
					value: "no",
				});
				yield* Databases.updateFieldValue({
					recordId: second.id,
					fieldId: flagA.id,
					value: "no",
				});
				yield* Databases.updateFieldValue({
					recordId: second.id,
					fieldId: flagB.id,
					value: "yes",
				});
				return { db, flagA };
			}),
		);

	test("a fieldId filter picks the right cell when two fields share a name", async () => {
		using api = restWorkspace();
		const { db, flagA } = await sameNamed(api);
		await api.run(
			Databases.createView({
				databaseId: db.id,
				name: "Flag A set",
				type: "table",
				groupByFieldId: null,
				config: JSON.stringify({
					filters: [{ fieldId: flagA.id, operator: "is", value: "yes" }],
					sorts: [],
					boardHidden: [],
				}),
			}),
		);
		const res = await api.call("GET", recordsUrl(db.id, "?view=Flag A set"), {
			key: "read",
		});
		expect(res.status).toBe(200);
		expect(titles(res.json)).toEqual(["first"]);
	});

	test("a view's sorts order the response, the first sort winning", async () => {
		using api = restWorkspace();
		const { db, points, due } = await api.run(
			Effect.gen(function* () {
				const page = yield* Pages.createPage({ title: "S", parentId: null });
				const db = yield* Databases.createDatabase({
					pageId: page.id,
					name: "Sorted",
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
				// Created in the reverse of the expected order, so a view that is not
				// honoured (or is sorted the wrong way) fails rather than passes by
				// accident of creation order.
				for (const [title, p, d] of [
					["late-low", "2", "2026-03-01"],
					["early-high", "1", "2026-01-01"],
				] as const) {
					const r = yield* Databases.createRecord({
						databaseId: db.id,
						title,
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
				return { db, points, due };
			}),
		);
		// Points asc first, so it must outrank the Due desc that follows: the
		// two orders disagree here, so a wrong precedence flips the result.
		await api.run(
			Databases.createView({
				databaseId: db.id,
				name: "By Points",
				type: "table",
				groupByFieldId: null,
				config: JSON.stringify({
					filters: [],
					sorts: [
						{ fieldId: points.id, direction: "asc" },
						{ fieldId: due.id, direction: "desc" },
					],
					boardHidden: [],
				}),
			}),
		);
		const res = await api.call("GET", recordsUrl(db.id, "?view=By Points"), {
			key: "read",
		});
		expect(res.status).toBe(200);
		expect(titles(res.json)).toEqual(["early-high", "late-low"]);
	});
});
