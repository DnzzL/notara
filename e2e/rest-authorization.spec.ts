/**
 * Every REST route refuses a caller who does not belong to the workspace.
 *
 * `api-v1/routes.ts` had no tests at all — noted in NOT-104, inherited by
 * NOT-122. Twenty-eight routes, each carrying its own hand-assembled sequence of
 * resolve-user, check-membership, check-permission, and nothing asserting that
 * any of them actually did it. NOT-102 was exactly that failure on the RPC side:
 * a handler that simply never wrote the check its neighbours had.
 *
 * The table below is the point. A new route added without a guard has to be
 * added here too, and adding it here makes the omission fail.
 */
import { expect, seedPage, test } from "./multiuser-helpers.js";

type Route = {
	method: "get" | "post" | "patch" | "delete" | "put";
	/** `:name` placeholders are filled from the seeded fixture. */
	path: string;
	body?: Record<string, unknown>;
};

/**
 * Every route under /api/v1 that acts on a workspace.
 *
 * `GET /api/v1/workspaces` is deliberately absent: it lists the caller's own
 * workspaces, so having a session is the whole of its authorization.
 */
const ROUTES: Route[] = [
	{ method: "get", path: "/pages" },
	{ method: "post", path: "/pages", body: { title: "Intruder" } },
	{ method: "get", path: "/pages/:pageId" },
	{ method: "patch", path: "/pages/:pageId", body: { title: "Renamed" } },
	{ method: "delete", path: "/pages/:pageId" },
	{ method: "post", path: "/pages/:pageId/restore" },
	{ method: "get", path: "/pages/:pageId/blocks" },
	{
		method: "post",
		path: "/pages/:pageId/blocks",
		body: { type: "paragraph", content: "<p>x</p>", index: 0 },
	},
	{ method: "patch", path: "/blocks/:blockId", body: { content: "<p>x</p>" } },
	{ method: "delete", path: "/blocks/:blockId" },
	{ method: "get", path: "/databases" },
	{
		method: "post",
		path: "/databases",
		body: { pageId: ":pageId", name: "X" },
	},
	{ method: "patch", path: "/databases/:dbId", body: { name: "X" } },
	{ method: "delete", path: "/databases/:dbId" },
	{ method: "post", path: "/databases/:dbId/restore" },
	{ method: "get", path: "/databases/:dbId/fields" },
	{
		method: "post",
		path: "/databases/:dbId/fields",
		body: { name: "F", type: "text" },
	},
	{
		method: "patch",
		path: "/databases/:dbId/fields/:fieldId",
		body: { name: "F" },
	},
	{ method: "delete", path: "/databases/:dbId/fields/:fieldId" },
	{ method: "get", path: "/databases/:dbId/records" },
	{ method: "post", path: "/databases/:dbId/records", body: { title: "R" } },
	{
		method: "patch",
		path: "/databases/:dbId/records/:recordId",
		body: { title: "R" },
	},
	{ method: "delete", path: "/databases/:dbId/records/:recordId" },
	{ method: "post", path: "/databases/:dbId/records/:recordId/restore" },
	{
		method: "put",
		path: "/databases/:dbId/records/:recordId/fields/:fieldId",
		body: { value: "x" },
	},
	{ method: "get", path: "/search?q=secret" },
	{ method: "get", path: "/trash" },
];

/** Ids from alice's workspace, which bob must not be able to touch. */
type Fixture = {
	workspaceId: string;
	pageId: string;
	blockId: string;
	dbId: string;
	fieldId: string;
	recordId: string;
};

const fill = (path: string, f: Fixture) =>
	`/api/v1/workspaces/${f.workspaceId}${path
		.replace(":pageId", f.pageId)
		.replace(":blockId", f.blockId)
		.replace(":dbId", f.dbId)
		.replace(":fieldId", f.fieldId)
		.replace(":recordId", f.recordId)}`;

const fillBody = (body: Record<string, unknown> | undefined, f: Fixture) =>
	body
		? JSON.parse(JSON.stringify(body).replace(":pageId", f.pageId))
		: undefined;

test("no REST route serves a caller who is not a workspace member", async ({
	alice,
	bob,
	soloWs,
}) => {
	// bob is authenticated and has a perfectly valid session. He is simply not in
	// this workspace — the shape of NOT-102.
	const { pageId } = await seedPage(alice, soloWs, "Private", ["Secret"]);

	const blocks = await alice.rpc<Array<{ id: string }>>(
		"listBlocks",
		{ pageId },
		soloWs.workspaceId,
	);
	const db = await alice.rpc<{ id: string }>(
		"createDatabase",
		{ pageId, name: "Secrets" },
		soloWs.workspaceId,
	);
	const field = await alice.rpc<{ id: string }>(
		"createField",
		{
			databaseId: db.id,
			name: "Note",
			type: "text",
			options: null,
			relationTargetDbId: null,
		},
		soloWs.workspaceId,
	);
	const record = await alice.rpc<{ id: string }>(
		"createRecord",
		{ databaseId: db.id, title: "Row" },
		soloWs.workspaceId,
	);

	const fixture: Fixture = {
		workspaceId: soloWs.workspaceId,
		pageId,
		blockId: blocks[0].id,
		dbId: db.id,
		fieldId: field.id,
		recordId: record.id,
	};

	const served: string[] = [];

	for (const route of ROUTES) {
		const url = fill(route.path, fixture);
		const res = await bob.api[route.method](url, {
			data: fillBody(route.body, fixture),
		});

		// 403 is the honest answer; 404 is acceptable where the route refuses by
		// declining to admit the resource exists. Anything 2xx is a leak.
		if (res.status() < 400) {
			served.push(
				`${route.method.toUpperCase()} ${route.path} → ${res.status()}`,
			);
		}
	}

	expect(
		served,
		`REST routes served a non-member:\n  ${served.join("\n  ")}`,
	).toEqual([]);
});

test("the route table here covers every registered workspace route", async ({
	alice,
	soloWs,
}) => {
	// Without this, a route added without a guard is also a route nobody
	// remembered to list above — and the test would pass by not asking.
	const spec = (await (await alice.api.get("/api/v1/openapi.json")).json()) as {
		paths: Record<string, Record<string, unknown>>;
	};

	const documented = new Set<string>();
	for (const [path, item] of Object.entries(spec.paths)) {
		for (const method of Object.keys(item)) {
			if (!["get", "post", "put", "patch", "delete"].includes(method)) continue;
			// Only workspace-scoped routes; /workspaces itself is self-scoped.
			if (!path.startsWith("/workspaces/{workspaceId}")) continue;
			documented.add(
				`${method} ${path.replace("/workspaces/{workspaceId}", "").replace(/\{(\w+)\}/g, ":$1")}`,
			);
		}
	}

	const covered = new Set(
		ROUTES.map((r) => `${r.method} ${r.path.split("?")[0]}`),
	);
	const missing = [...documented].filter((d) => !covered.has(d));

	expect(
		missing,
		`workspace routes with no authorization test:\n  ${missing.join("\n  ")}`,
	).toEqual([]);
});
