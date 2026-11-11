/**
 * The move and reorder operations through the REST door, end to end
 * (NA-17). Same harness as rest-pages.test.ts: booted server, real SQLite
 * workspace, real API keys.
 */

import { afterAll, describe, expect, test } from "bun:test";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PORT = 3482;
const BASE = `http://localhost:${PORT}`;
const DATA_DIR = join(tmpdir(), `notara-rest-reorder-${process.pid}`);

// Booted at module scope, as in route-auth.test.ts: hooks carry bun's 5s
// default timeout, and a cold runner needs longer to migrate and listen.
const server = Bun.spawn(
	["bun", join(import.meta.dir, "..", "src", "index.ts")],
	{
		env: {
			...process.env,
			PORT: String(PORT),
			DATA_DIR,
			BETTER_AUTH_SECRET: "test-secret-for-rest-reorder-checks-only",
			BETTER_AUTH_URL: BASE,
			ADMIN_EMAILS: "",
		},
		stdout: "pipe",
		stderr: "pipe",
	},
);

let up = false;
for (let i = 0; i < 300 && !up; i++) {
	try {
		up = (await fetch(`${BASE}/health`)).ok;
	} catch {}
	if (!up) await Bun.sleep(100);
}
if (!up) {
	const stderr = await new Response(server.stderr as ReadableStream).text();
	server.kill();
	throw new Error(`server did not come up in 30s:\n${stderr}`);
}

afterAll(() => {
	server?.kill();
	rmSync(DATA_DIR, { recursive: true, force: true });
});

// ── Fixture: set up through the app's own doors (auth + RPC) ─────────────────

const signUp = async (email: string) => {
	const res = await fetch(`${BASE}/api/auth/sign-up/email`, {
		method: "POST",
		headers: { "Content-Type": "application/json", Origin: BASE },
		body: JSON.stringify({ email, password: "correct-horse-1", name: email }),
	});
	if (!res.ok) throw new Error(`sign-up ${email}: ${await res.text()}`);
	const cookie = res.headers
		.getSetCookie()
		.map((c) => c.split(";")[0])
		.join("; ");
	const { user } = (await res.json()) as { user: { id: string } };
	return { cookie, userId: user.id };
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

const owner = await signUp("owner@example.com");
const ws = await rpc<{ id: string }>(owner.cookie, "createWorkspace", {
	name: "Reorder",
	slug: "reorder",
});
const key = async (cookie: string, scope: "read" | "write") =>
	(
		await rpc<{ rawKey: string }>(cookie, "createApiKey", {
			name: `${scope} key`,
			scope,
		})
	).rawKey;
const writeKey = await key(owner.cookie, "write");
const readKey = await key(owner.cookie, "read");

const PAGES = `/api/v1/workspaces/${ws.id}/pages`;

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

const WS = `/api/v1/workspaces/${ws.id}`;
const DBS = `${WS}/databases`;
const newPage = async (title: string, parentId: string | null = null) =>
	(await call(writeKey, "POST", PAGES, { title, parentId })).body.id as string;
const ids = (rows: Array<{ id: string }>) => rows.map((r) => r.id);

describe("movePage", () => {
	test("reparents a page and back to the top level", async () => {
		const a = await newPage("A");
		const b = await newPage("B");
		const moved = await call(writeKey, "POST", `${PAGES}/${b}/move`, {
			parentId: a,
		});
		expect(moved.status).toBe(200);
		expect(moved.body.parentId).toBe(a);
		const top = await call(writeKey, "POST", `${PAGES}/${b}/move`, {
			parentId: null,
		});
		expect(top.body.parentId).toBeNull();
	});
	test("a page cannot move into itself (409)", async () => {
		const a = await newPage("A");
		const res = await call(writeKey, "POST", `${PAGES}/${a}/move`, {
			parentId: a,
		});
		expect(res.status).toBe(409);
	});
	test("a read-only key is refused", async () => {
		const a = await newPage("A");
		const res = await call(readKey, "POST", `${PAGES}/${a}/move`, {
			parentId: null,
		});
		expect(res.status).toBe(403);
	});
});

describe("reorderPages", () => {
	test("reorders the children of a parent", async () => {
		const p = await newPage("P");
		const c1 = await newPage("c1", p);
		const c2 = await newPage("c2", p);
		const res = await call(writeKey, "POST", `${PAGES}/reorder`, {
			parentId: p,
			pageIds: [c2, c1],
		});
		expect(res).toEqual({ status: 200, body: { reordered: true } });
		const listed = (await call(readKey, "GET", PAGES)).body as Array<{
			id: string;
			parentId: string | null;
		}>;
		expect(ids(listed.filter((x) => x.parentId === p))).toEqual([c2, c1]);
	});
	test("a read-only key is refused", async () => {
		const res = await call(readKey, "POST", `${PAGES}/reorder`, {
			parentId: null,
			pageIds: [],
		});
		expect(res.status).toBe(403);
	});
});

describe("updateBlock type change and reorderBlocks", () => {
	const blocksOf = (pageId: string) => `${PAGES}/${pageId}/blocks`;
	test("turn a block into another type", async () => {
		const pageId = await newPage("T");
		const { body: block } = await call(writeKey, "POST", blocksOf(pageId), {
			type: "paragraph",
			content: "<p>x</p>",
		});
		const res = await call(writeKey, "PATCH", `${WS}/blocks/${block.id}`, {
			content: "<p>x</p>",
			type: "heading1",
		});
		expect(res.status).toBe(200);
		expect(res.body.type).toBe("heading1");
	});
	test("an unknown type is refused (422)", async () => {
		const pageId = await newPage("T");
		const { body: block } = await call(writeKey, "POST", blocksOf(pageId), {
			type: "paragraph",
			content: "<p>x</p>",
		});
		const res = await call(writeKey, "PATCH", `${WS}/blocks/${block.id}`, {
			content: "<p>x</p>",
			type: "banner",
		});
		expect(res.status).toBe(422);
	});
	test("a read-only key cannot change the type", async () => {
		const res = await call(readKey, "PATCH", `${WS}/blocks/any`, {
			content: "<p></p>",
			type: "heading1",
		});
		expect(res.status).toBe(403);
	});
	test("reorderBlocks returns the blocks in the new order", async () => {
		const pageId = await newPage("R");
		const mk = async (n: number) =>
			(
				await call(writeKey, "POST", blocksOf(pageId), {
					type: "paragraph",
					content: `<p>${n}</p>`,
					index: n,
				})
			).body.id as string;
		const [b0, b1] = [await mk(0), await mk(1)];
		const res = await call(writeKey, "POST", `${blocksOf(pageId)}/reorder`, {
			blockIds: [b1, b0],
		});
		expect(res.status).toBe(200);
		expect(ids(res.body)).toEqual([b1, b0]);
		expect(ids((await call(readKey, "GET", blocksOf(pageId))).body)).toEqual([
			b1,
			b0,
		]);
	});
	test("reorderBlocks with a read-only key is refused", async () => {
		const pageId = await newPage("R");
		const res = await call(readKey, "POST", `${blocksOf(pageId)}/reorder`, {
			blockIds: [],
		});
		expect(res.status).toBe(403);
	});
});

describe("reorderFields, reorderRecords, reorderDatabases", () => {
	const setup = async () => {
		const pageId = await newPage("DB page");
		const db = (await call(writeKey, "POST", DBS, { pageId, name: "Tasks" }))
			.body;
		const f = async (name: string) =>
			(
				await call(writeKey, "POST", `${DBS}/${db.id}/fields`, {
					name,
					type: "text",
				})
			).body.id as string;
		const r = async (title: string) =>
			(await call(writeKey, "POST", `${DBS}/${db.id}/records`, { title })).body
				.id as string;
		return { pageId, db, f, r };
	};

	test("reorderFields", async () => {
		const { db, f } = await setup();
		const [f1, f2] = [await f("one"), await f("two")];
		const res = await call(writeKey, "POST", `${DBS}/${db.id}/fields/reorder`, {
			fieldIds: [f2, f1],
		});
		expect(res).toEqual({ status: 200, body: { reordered: true } });
		const listed = (await call(readKey, "GET", `${DBS}/${db.id}/fields`)).body;
		expect(ids(listed).filter((i: string) => i === f1 || i === f2)).toEqual([
			f2,
			f1,
		]);
	});
	test("reorderRecords", async () => {
		const { db, r } = await setup();
		const [r1, r2] = [await r("one"), await r("two")];
		const res = await call(
			writeKey,
			"POST",
			`${DBS}/${db.id}/records/reorder`,
			{ recordIds: [r2, r1] },
		);
		expect(res).toEqual({ status: 200, body: { reordered: true } });
		const listed = (await call(readKey, "GET", `${DBS}/${db.id}/records`)).body;
		expect(ids(listed)).toEqual([r2, r1]);
	});
	test("reorderDatabases", async () => {
		const { pageId, db } = await setup();
		const db2 = (await call(writeKey, "POST", DBS, { pageId, name: "Second" }))
			.body;
		const res = await call(writeKey, "POST", `${DBS}/reorder`, {
			pageId,
			databaseIds: [db2.id, db.id],
		});
		expect(res).toEqual({ status: 200, body: { reordered: true } });
		const listed = (await call(readKey, "GET", DBS)).body as Array<{
			id: string;
			pageId: string;
		}>;
		expect(ids(listed.filter((d) => d.pageId === pageId))).toEqual([
			db2.id,
			db.id,
		]);
	});
	test("a read-only key is refused on all three", async () => {
		const { pageId, db } = await setup();
		for (const [path, body] of [
			[`${DBS}/${db.id}/fields/reorder`, { fieldIds: [] }],
			[`${DBS}/${db.id}/records/reorder`, { recordIds: [] }],
			[`${DBS}/reorder`, { pageId, databaseIds: [] }],
		] as const)
			expect((await call(readKey, "POST", path, body)).status).toBe(403);
	});
});
