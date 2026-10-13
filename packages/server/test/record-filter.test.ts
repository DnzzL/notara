/**
 * Filtering records over REST (NOT-153): a runner lists only the cards in a
 * given status, or assigned to a given agent, without downloading the board.
 */
import { describe, expect, test } from "bun:test";
import { Effect } from "effect";
import * as Databases from "../src/handlers/databases.js";
import * as Pages from "../src/handlers/pages.js";
import { restWorkspace, WORKSPACE } from "./rest-harness.js";

/** A board: Status (select), Labels (multiSelect), and three cards. */
const board = async (api: ReturnType<typeof restWorkspace>) =>
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
			const labels = yield* Databases.createField({
				databaseId: db.id,
				name: "Labels",
				type: "multiSelect",
				options: ["bug", "enhancement"],
				relationTargetDbId: null,
			});
			for (const [title, s, l] of [
				["a", "ready-for-agent", ["bug"]],
				["b", "ready-for-agent", ["enhancement"]],
				["c", "done", ["bug"]],
			] as const) {
				const r = yield* Databases.createRecord({ databaseId: db.id, title });
				yield* Databases.updateFieldValue({
					recordId: r.id,
					fieldId: status.id,
					value: s,
				});
				yield* Databases.updateFieldValue({
					recordId: r.id,
					fieldId: labels.id,
					value: JSON.stringify(l),
				});
			}
			return { db, status };
		}),
	);

const titles = (json: Array<{ title: string }>) =>
	json.map((r) => r.title).sort();

describe("filtering records over REST", () => {
	const url = (dbId: string, query: string) =>
		`/api/v1/workspaces/${WORKSPACE}/databases/${dbId}/records${query}`;

	test("a field=value pair keeps the matching records, by field name or id", async () => {
		using api = restWorkspace();
		const { db, status } = await board(api);
		const byName = await api.call(
			"GET",
			url(db.id, "?field=Status&value=ready-for-agent"),
			{
				key: "read",
			},
		);
		const byId = await api.call(
			"GET",
			url(db.id, `?field=${status.id}&value=done`),
			{
				key: "read",
			},
		);
		expect(byName.status).toBe(200);
		expect(titles(byName.json)).toEqual(["a", "b"]);
		expect(titles(byId.json)).toEqual(["c"]);
	});

	test("several pairs combine with AND; a multi-value field matches by membership", async () => {
		using api = restWorkspace();
		const { db } = await board(api);
		const res = await api.call(
			"GET",
			url(db.id, "?field=Status&value=ready-for-agent&field=Labels&value=bug"),
			{ key: "read" },
		);
		expect(titles(res.json)).toEqual(["a"]);
	});

	test("an unknown field is a 400 that names it", async () => {
		using api = restWorkspace();
		const { db } = await board(api);
		const res = await api.call("GET", url(db.id, "?field=Owner&value=x"), {
			key: "read",
		});
		expect(res.status).toBe(400);
		expect(res.json.error).toContain("Owner");
	});

	test("a field without its value is a 400", async () => {
		using api = restWorkspace();
		const { db } = await board(api);
		const res = await api.call("GET", url(db.id, "?field=Status"), {
			key: "read",
		});
		expect(res.status).toBe(400);
	});
});

describe("filtering by every kind of value", () => {
	const url = (dbId: string, query: string) =>
		`/api/v1/workspaces/${WORKSPACE}/databases/${dbId}/records${query}`;

	/** A database with Done (checkbox), Points (number), Tags (multiSelect),
	 * and two fields both named Twin; card "set" fills them, "blank" does not. */
	const kinds = (api: ReturnType<typeof restWorkspace>) =>
		api.run(
			Effect.gen(function* () {
				const page = yield* Pages.createPage({ title: "P", parentId: null });
				const db = yield* Databases.createDatabase({
					pageId: page.id,
					name: "K",
				});
				const field = (
					name: string,
					type: "checkbox" | "number" | "multiSelect" | "text",
				) =>
					Databases.createField({
						databaseId: db.id,
						name,
						type,
						options: type === "multiSelect" ? ["x"] : null,
						relationTargetDbId: null,
					});
				const done = yield* field("Done", "checkbox");
				const points = yield* field("Points", "number");
				const tags = yield* field("Tags", "multiSelect");
				const twinA = yield* field("Twin", "text");
				const twinB = yield* field("Twin", "text");
				const set = yield* Databases.createRecord({
					databaseId: db.id,
					title: "set",
				});
				yield* Databases.createRecord({ databaseId: db.id, title: "blank" });
				for (const [f, v] of [
					[done, "true"],
					[points, "1"],
					[tags, '["x"]'],
					[twinA, "a"],
					[twinB, "b"],
				] as const)
					yield* Databases.updateFieldValue({
						recordId: set.id,
						fieldId: f.id,
						value: v,
					});
				return { db, twinA, twinB };
			}),
		);

	const titlesFor = async (
		api: ReturnType<typeof restWorkspace>,
		dbId: string,
		q: string,
	) => titles((await api.call("GET", url(dbId, q), { key: "read" })).json);

	test("a checkbox never ticked counts as false", async () => {
		using api = restWorkspace();
		const { db } = await kinds(api);
		expect(await titlesFor(api, db.id, "?field=Done&value=false")).toEqual([
			"blank",
		]);
		expect(await titlesFor(api, db.id, "?field=Done&value=true")).toEqual([
			"set",
		]);
	});

	test("a number matches however it is written", async () => {
		using api = restWorkspace();
		const { db } = await kinds(api);
		expect(await titlesFor(api, db.id, "?field=Points&value=1.0")).toEqual([
			"set",
		]);
	});

	test("an empty value matches an empty field, lists included", async () => {
		using api = restWorkspace();
		const { db } = await kinds(api);
		expect(await titlesFor(api, db.id, "?field=Tags&value=")).toEqual([
			"blank",
		]);
		expect(await titlesFor(api, db.id, "?field=Points&value=")).toEqual([
			"blank",
		]);
	});

	test("a field named by id is that field, even when another shares its name", async () => {
		using api = restWorkspace();
		const { db, twinA, twinB } = await kinds(api);
		expect(await titlesFor(api, db.id, `?field=${twinA.id}&value=a`)).toEqual([
			"set",
		]);
		expect(await titlesFor(api, db.id, `?field=${twinB.id}&value=b`)).toEqual([
			"set",
		]);
	});
});
