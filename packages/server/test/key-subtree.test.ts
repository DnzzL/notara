/**
 * An API key limited to a page subtree (NOT-184), end to end through the REST
 * door, one family of operations at a time, plus one MCP call: the key reaches
 * its root page and everything below it, and nothing else. Same harness as
 * rest-exchange.test.ts.
 */

import { afterAll, describe, expect, test } from "bun:test";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { bootServer } from "./boot-server.js";

const DATA_DIR = join(tmpdir(), `notara-key-subtree-${process.pid}`);

const { proc: server, base: BASE } = await bootServer((base) => ({
	DATA_DIR,
	BETTER_AUTH_SECRET: "test-secret-for-key-subtree-only",
	BETTER_AUTH_URL: base,
	ADMIN_EMAILS: "",
}));

afterAll(() => {
	server?.kill();
	rmSync(DATA_DIR, { recursive: true, force: true });
});

const signUp = async (email: string) => {
	const res = await fetch(`${BASE}/api/auth/sign-up/email`, {
		method: "POST",
		headers: { "Content-Type": "application/json", Origin: BASE },
		body: JSON.stringify({ email, password: "correct-horse-1", name: email }),
	});
	if (!res.ok) throw new Error(`sign-up ${email}: ${await res.text()}`);
	return res.headers
		.getSetCookie()
		.map((c) => c.split(";")[0])
		.join("; ");
};

let rpcId = 0;
const rpc = async <T>(
	cookie: string,
	tag: string,
	payload: unknown,
	workspaceId?: string,
): Promise<T> => {
	const id = String(++rpcId);
	const res = await fetch(`${BASE}/api`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Cookie: cookie,
			...(workspaceId ? { "X-Workspace-Id": workspaceId } : {}),
		},
		body: JSON.stringify({ _tag: "Request", id, tag, payload, headers: [] }),
	});
	const messages = (await res.json()) as Array<{
		_tag: string;
		requestId?: string;
		exit?: { _tag: string; value?: T };
	}>;
	const exit = messages.find((m) => m._tag === "Exit" && m.requestId === id);
	if (exit?.exit?._tag !== "Success")
		throw new Error(`rpc ${tag}: ${JSON.stringify(messages)}`);
	return exit.exit.value as T;
};

const call = async (
	apiKey: string,
	method: string,
	path: string,
	body?: unknown,
) => {
	const res = await fetch(`${BASE}${path}`, {
		method,
		headers: {
			Authorization: `Bearer ${apiKey}`,
			"Content-Type": "application/json",
		},
		body: body === undefined ? undefined : JSON.stringify(body),
	});
	const text = await res.text();
	return { status: res.status, body: (text ? JSON.parse(text) : null) as any };
};

const cookie = await signUp("owner@example.com");
const ws = await rpc<{ id: string }>(cookie, "createWorkspace", {
	name: "Subtree",
	slug: "subtree",
});
const WS = `/api/v1/workspaces/${ws.id}`;
const PAGES = `${WS}/pages`;

/** The unscoped write key everything is built with. */
const all = (
	await rpc<{ rawKey: string }>(cookie, "createApiKey", {
		name: "all",
		scope: "write",
	})
).rawKey;

const page = async (title: string, parentId: string | null = null) =>
	(await call(all, "POST", PAGES, { title, parentId })).body as { id: string };

// root ─ child ─ grandchild        outside
const root = await page("Root");
const child = await page("Child", root.id);
const grand = await page("Grandchild", child.id);
const outside = await page("Outside");

const scoped = (
	await rpc<{ rawKey: string; rootPageId: string }>(
		cookie,
		"createApiKey",
		{ name: "scoped", scope: "write", rootPageId: root.id },
		ws.id,
	)
).rawKey;

const block = async (pageId: string, content: string) =>
	(
		await call(all, "POST", `${PAGES}/${pageId}/blocks`, {
			type: "paragraph",
			content,
			index: 0,
		})
	).body as { id: string };

const dbOn = async (pageId: string) => {
	const db = (
		await call(all, "POST", `${WS}/databases`, { pageId, name: "Tasks" })
	).body;
	const rec = (
		await call(all, "POST", `${WS}/databases/${db.id}/records`, {
			title: "Zebra record",
		})
	).body;
	return { db: db.id as string, rec: rec.id as string };
};

describe("creating a key with a root page", () => {
	test("the root is stored and listed; an unknown root is refused", async () => {
		const keys = await rpc<Array<{ name: string; rootPageId: string | null }>>(
			cookie,
			"listApiKeys",
			null,
		);
		expect(keys.find((k) => k.name === "scoped")?.rootPageId).toBe(root.id);
		expect(keys.find((k) => k.name === "all")?.rootPageId).toBeNull();
		await expect(
			rpc(
				cookie,
				"createApiKey",
				{ name: "bad", scope: "read", rootPageId: "nope" },
				ws.id,
			),
		).rejects.toThrow();
	});

	test("an unscoped key still sees everything", async () => {
		const ids = (await call(all, "GET", PAGES)).body.map((p: any) => p.id);
		expect(ids).toEqual(
			expect.arrayContaining([root.id, child.id, grand.id, outside.id]),
		);
	});
});

describe("pages", () => {
	test("reads and writes inside the subtree, nothing outside", async () => {
		const listed = (await call(scoped, "GET", PAGES)).body.map(
			(p: any) => p.id,
		);
		expect(listed.sort()).toEqual([root.id, child.id, grand.id].sort());

		expect((await call(scoped, "GET", `${PAGES}/${grand.id}`)).status).toBe(
			200,
		);
		expect(
			(await call(scoped, "PATCH", `${PAGES}/${grand.id}`, { title: "G2" }))
				.status,
		).toBe(200);

		expect((await call(scoped, "GET", `${PAGES}/${outside.id}`)).status).toBe(
			403,
		);
		expect(
			(await call(scoped, "PATCH", `${PAGES}/${outside.id}`, { title: "x" }))
				.status,
		).toBe(403);
		expect(
			(await call(scoped, "DELETE", `${PAGES}/${outside.id}`)).status,
		).toBe(403);
	});

	test("a new page must land inside the subtree", async () => {
		expect((await call(scoped, "POST", PAGES, { title: "Top" })).status).toBe(
			403,
		);
		expect(
			(await call(scoped, "POST", PAGES, { title: "X", parentId: outside.id }))
				.status,
		).toBe(403);
		expect(
			(await call(scoped, "POST", PAGES, { title: "Ok", parentId: child.id }))
				.status,
		).toBe(201);
	});

	test("a page cannot be moved or reordered out of the subtree", async () => {
		const move = (id: string, parentId: string | null) =>
			call(scoped, "POST", `${PAGES}/${id}/move`, { parentId });
		expect((await move(child.id, outside.id)).status).toBe(403);
		expect((await move(child.id, null)).status).toBe(403);
		expect((await move(outside.id, root.id)).status).toBe(403);
		expect(
			(
				await call(scoped, "POST", `${PAGES}/reorder`, {
					parentId: null,
					pageIds: [root.id, outside.id],
				})
			).status,
		).toBe(403);
	});
});

describe("blocks", () => {
	test("a block outside is out of reach by page and by id", async () => {
		const out = await block(outside.id, "<p>secret</p>");
		expect(
			(await call(scoped, "GET", `${PAGES}/${outside.id}/blocks`)).status,
		).toBe(403);
		expect(
			(
				await call(scoped, "POST", `${PAGES}/${outside.id}/blocks`, {
					type: "paragraph",
					content: "<p>x</p>",
					index: 0,
				})
			).status,
		).toBe(403);
		expect(
			(
				await call(scoped, "PATCH", `${WS}/blocks/${out.id}`, {
					content: "<p>y</p>",
				})
			).status,
		).toBe(403);
		expect(
			(await call(scoped, "DELETE", `${WS}/blocks/${out.id}`)).status,
		).toBe(403);

		const mk = (pageId: string, extra: object = {}) =>
			call(scoped, "POST", `${PAGES}/${pageId}/blocks`, {
				type: "paragraph",
				content: "<p>m</p>",
				index: 0,
				...extra,
			});
		const top = await mk(child.id);
		expect(top.status).toBe(201);
		expect((await mk(child.id, { parentId: top.body.id })).status).toBe(201);
		const inside = await block(child.id, "<p>mine</p>");
		expect(
			(await call(scoped, "GET", `${PAGES}/${child.id}/blocks`)).body.map(
				(b: any) => b.id,
			),
		).toContain(inside.id);
	});
});

describe("databases and records", () => {
	test("only the subtree's databases and their records", async () => {
		const out = await dbOn(outside.id);
		const inn = await dbOn(child.id);
		const D = `${WS}/databases`;

		const listed = (await call(scoped, "GET", D)).body.map((d: any) => d.id);
		expect(listed).toEqual([inn.db]);

		for (const [method, path, body] of [
			["GET", `${D}/${out.db}`],
			["GET", `${D}/${out.db}/records`],
			["POST", `${D}/${out.db}/records`, { title: "x" }],
			["PATCH", `${D}/${out.db}/records/${out.rec}`, { title: "x" }],
			["DELETE", `${D}/${out.db}/records/${out.rec}`],
			["GET", `${D}/${out.db}/fields`],
		] as const) {
			expect((await call(scoped, method, path, body)).status).toBe(403);
		}
		expect((await call(scoped, "GET", `${D}/${inn.db}/records`)).status).toBe(
			200,
		);
		expect(
			(await call(scoped, "POST", D, { pageId: outside.id, name: "no" }))
				.status,
		).toBe(403);
	});
});

describe("search, backlinks, export, templates, trash, members", () => {
	test("search finds only inside the subtree", async () => {
		await page("Quokka inside", child.id);
		await page("Quokka outside");
		const hits = (await call(scoped, "GET", `${WS}/search?q=Quokka`)).body;
		expect(hits.map((h: any) => h.title)).toEqual(["Quokka inside"]);
		expect((await call(all, "GET", `${WS}/search?q=Quokka`)).body).toHaveLength(
			2,
		);
	});

	test("backlinks from outside are hidden, and a target outside is refused", async () => {
		const src = await page("Linker");
		await block(src.id, `<p><span data-page-ref="${child.id}">C</span></p>`);
		expect(
			(await call(scoped, "GET", `${PAGES}/${child.id}/backlinks`)).body,
		).toEqual([]);
		expect(
			(await call(all, "GET", `${PAGES}/${child.id}/backlinks`)).body,
		).toHaveLength(1);
		expect(
			(await call(scoped, "GET", `${PAGES}/${outside.id}/backlinks`)).status,
		).toBe(403);
	});

	test("export is refused outside, allowed inside", async () => {
		expect(
			(await call(scoped, "GET", `${PAGES}/${outside.id}/export`)).status,
		).toBe(403);
		expect(
			(await call(scoped, "GET", `${PAGES}/${child.id}/export`)).status,
		).toBe(200);
		const out = await dbOn(outside.id);
		expect(
			(await call(scoped, "GET", `${WS}/databases/${out.db}/export`)).status,
		).toBe(403);
	});

	test("a template page must land inside the subtree", async () => {
		const path = `${WS}/templates/meeting-notes/pages`;
		expect((await call(scoped, "POST", path, {})).status).toBe(403);
		expect(
			(await call(scoped, "POST", path, { parentId: outside.id })).status,
		).toBe(403);
		expect(
			(await call(scoped, "POST", path, { parentId: child.id })).status,
		).toBe(201);
	});

	test("trash lists only the subtree's", async () => {
		const a = await page("Trash in", child.id);
		const b = await page("Trash out");
		await call(all, "DELETE", `${PAGES}/${a.id}`);
		await call(all, "DELETE", `${PAGES}/${b.id}`);
		const ids = (await call(scoped, "GET", `${WS}/trash`)).body.pages.map(
			(p: any) => p.id,
		);
		expect(ids).toContain(a.id);
		expect(ids).not.toContain(b.id);
		expect(
			(await call(scoped, "POST", `${PAGES}/${b.id}/restore`)).status,
		).toBe(403);
	});

	test("workspace-wide operations are refused to a scoped key", async () => {
		expect((await call(scoped, "GET", `${WS}/members`)).status).toBe(403);
		expect((await call(all, "GET", `${WS}/members`)).status).toBe(200);
		expect((await call(scoped, "POST", `${WS}/invites/link`)).status).toBe(403);
		// Listing workspaces names no page; the key may still do it.
		expect((await call(scoped, "GET", "/api/v1/workspaces")).status).toBe(200);
	});
});

describe("moving a page in or out of the subtree changes access", () => {
	test("in, then out again", async () => {
		const m = await page("Mover", outside.id);
		const get = () => call(scoped, "GET", `${PAGES}/${m.id}`);
		const move = (parentId: string) =>
			call(all, "POST", `${PAGES}/${m.id}/move`, { parentId });

		expect((await get()).status).toBe(403);
		expect((await move(child.id)).status).toBe(200);
		expect((await get()).status).toBe(200);
		expect(
			(await call(scoped, "GET", PAGES)).body.map((p: any) => p.id),
		).toContain(m.id);
		expect((await move(outside.id)).status).toBe(200);
		expect((await get()).status).toBe(403);
		expect(
			(await call(scoped, "GET", PAGES)).body.map((p: any) => p.id),
		).not.toContain(m.id);
	});
});

describe("the MCP door enforces the same subtree", () => {
	test("a tool call on a page outside is refused, inside succeeds", async () => {
		const mcp = (name: string, args: object) =>
			fetch(`${BASE}/mcp`, {
				method: "POST",
				headers: {
					Authorization: `Bearer ${scoped}`,
					"Content-Type": "application/json",
					Accept: "application/json, text/event-stream",
					"mcp-protocol-version": "2026-07-28",
					"mcp-method": "tools/call",
					"mcp-name": name,
				},
				body: JSON.stringify({
					jsonrpc: "2.0",
					id: 1,
					method: "tools/call",
					params: {
						name,
						arguments: args,
						_meta: {
							"io.modelcontextprotocol/protocolVersion": "2026-07-28",
							"io.modelcontextprotocol/clientCapabilities": {},
							"io.modelcontextprotocol/clientInfo": { name: "t", version: "1" },
						},
					},
				}),
			}).then((r) => r.text());
		const refused = await mcp("getPage", {
			workspaceId: ws.id,
			pageId: outside.id,
		});
		expect(refused).toContain("Insufficient permission");
		const ok = await mcp("getPage", { workspaceId: ws.id, pageId: child.id });
		expect(ok).toContain(child.id);
	});
});
