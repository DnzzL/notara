/**
 * Backlinks, templates and export through the REST door, end to end (NA-19).
 * Same harness as rest-blocks-search-trash.test.ts.
 */

import { afterAll, describe, expect, test } from "bun:test";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PORT = 3472;
const BASE = `http://localhost:${PORT}`;
const DATA_DIR = join(tmpdir(), `notara-rest-exchange-${process.pid}`);

// Booted at module scope, as in route-auth.test.ts: hooks carry bun's 5s
// default timeout, and a cold runner needs longer to migrate and listen.
const server = Bun.spawn(
	["bun", join(import.meta.dir, "..", "src", "index.ts")],
	{
		env: {
			...process.env,
			PORT: String(PORT),
			DATA_DIR,
			BETTER_AUTH_SECRET: "test-secret-for-rest-exchange-checks-only",
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
	name: "Exchange",
	slug: "exchange",
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

describe("getBacklinks", () => {
	test("lists the blocks that link to the page; a stranger's key is refused", async () => {
		const target = (await call(writeKey, "POST", PAGES, { title: "T" })).body;
		const source = (await call(writeKey, "POST", PAGES, { title: "S" })).body;
		const block = await call(writeKey, "POST", `${PAGES}/${source.id}/blocks`, {
			type: "paragraph",
			content: `<p><span data-page-ref="${target.id}">T</span></p>`,
			index: 0,
		});
		const res = await call(readKey, "GET", `${PAGES}/${target.id}/backlinks`);
		expect(res.status).toBe(200);
		expect(res.body).toEqual([
			{
				blockId: block.body.id,
				pageId: source.id,
				pageTitle: "S",
				blockType: "paragraph",
				content: block.body.content,
			},
		]);
		const outsider = await key(
			(await signUp("outsider@example.com")).cookie,
			"read",
		);
		expect(
			(await call(outsider, "GET", `${PAGES}/${target.id}/backlinks`)).status,
		).toBe(403);
	});
});

describe("templates", () => {
	test("listTemplates returns the catalogue to a read key", async () => {
		const res = await call(readKey, "GET", "/api/v1/templates");
		expect(res.status).toBe(200);
		expect(res.body.map((t: { id: string }) => t.id)).toContain(
			"meeting-notes",
		);
		expect(Object.keys(res.body[0]).sort()).toEqual([
			"description",
			"icon",
			"id",
			"title",
		]);
	});

	test("createPageFromTemplate creates a page; a read key is refused", async () => {
		const path = `${WS}/templates/meeting-notes/pages`;
		const res = await call(writeKey, "POST", path, {});
		expect(res.status).toBe(201);
		const got = await call(readKey, "GET", `${PAGES}/${res.body.id}`);
		expect(got.status).toBe(200);
		expect(got.body.id).toBe(res.body.id);
		expect((await call(readKey, "POST", path, {})).status).toBe(403);
		expect(
			(await call(writeKey, "POST", `${WS}/templates/nope/pages`, {})).status,
		).toBe(404);
	});
});

describe("exports", () => {
	test("exportPage returns Markdown to a read key; a stranger is refused", async () => {
		const page = (await call(writeKey, "POST", PAGES, { title: "Exp" })).body;
		await call(writeKey, "POST", `${PAGES}/${page.id}/blocks`, {
			type: "paragraph",
			content: "<p>hello export</p>",
			index: 0,
		});
		const res = await call(readKey, "GET", `${PAGES}/${page.id}/export`);
		expect(res.status).toBe(200);
		expect(res.body).toMatchObject({ pageId: page.id, title: "Exp" });
		expect(res.body.markdown).toContain("hello export");
		const full = await call(
			readKey,
			"GET",
			`${PAGES}/${page.id}/export?includeDatabases=true`,
		);
		expect(full.status).toBe(200);
		expect(
			(
				await call(
					readKey,
					"GET",
					`${PAGES}/${page.id}/export?includeDatabases=maybe`,
				)
			).status,
		).toBe(422);
		const outsider = await key(
			(await signUp("outsider2@example.com")).cookie,
			"read",
		);
		expect(
			(await call(outsider, "GET", `${PAGES}/${page.id}/export`)).status,
		).toBe(403);
	});

	test("exportDatabase returns CSV to a read key; a stranger is refused", async () => {
		const page = (await call(writeKey, "POST", PAGES, { title: "Db" })).body;
		const db = (
			await call(writeKey, "POST", `${WS}/databases`, {
				pageId: page.id,
				name: "Tasks",
			})
		).body;
		await call(writeKey, "POST", `${WS}/databases/${db.id}/records`, {
			title: "Write tests",
		});
		const res = await call(readKey, "GET", `${WS}/databases/${db.id}/export`);
		expect(res.status).toBe(200);
		expect(res.body).toMatchObject({ dbId: db.id, name: "Tasks" });
		expect(res.body.csv).toContain("Write tests");
		const outsider = await key(
			(await signUp("outsider3@example.com")).cookie,
			"read",
		);
		expect(
			(await call(outsider, "GET", `${WS}/databases/${db.id}/export`)).status,
		).toBe(403);
	});
});
