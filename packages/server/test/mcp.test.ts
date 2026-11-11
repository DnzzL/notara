/**
 * The MCP door at /mcp, end to end (NOT-169.2).
 *
 * Booted server, real SQLite workspace, real API keys, spoken to over
 * Streamable HTTP exactly as an MCP client would: initialize-era sessions
 * (2025-11-25, 2025-06-18) and the stateless 2026-07-28 flow on one endpoint.
 */

import { afterAll, describe, expect, test } from "bun:test";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { typedOperations } from "../src/api-v1/operations.js";

const PORT = 3461;
const BASE = `http://localhost:${PORT}`;
const DATA_DIR = join(tmpdir(), `notara-mcp-${process.pid}`);

// Booted at module scope, as in route-auth.test.ts: hooks carry bun's 5s
// default timeout, and a cold runner needs longer to migrate and listen.
const server = Bun.spawn(
	["bun", join(import.meta.dir, "..", "src", "index.ts")],
	{
		env: {
			...process.env,
			PORT: String(PORT),
			DATA_DIR,
			BETTER_AUTH_SECRET: "test-secret-for-mcp-checks-only",
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
const member = await signUp("member@example.com");
const ws = await rpc<{ id: string }>(owner.cookie, "createWorkspace", {
	name: "Mcp",
	slug: "mcp",
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
const { inviteToken } = await rpc<{ inviteToken: string }>(
	owner.cookie,
	"regenerateInviteLink",
	{ workspaceId: ws.id },
);
await rpc(member.cookie, "joinWorkspaceByToken", { inviteToken });
const memberKey = await key(member.cookie, "write");

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

// ── An MCP client, both protocol eras ────────────────────────────────────────

type Reply = { status: number; body: any };

const post = async (
	headers: Record<string, string>,
	message: object,
): Promise<Reply & { session: string | null }> => {
	const res = await fetch(`${BASE}/mcp`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Accept: "application/json, text/event-stream",
			...headers,
		},
		body: JSON.stringify(message),
	});
	const text = await res.text();
	// A reply is plain JSON or, for multi-message answers, one SSE `data:` line.
	const json = text.startsWith("{")
		? text
		: text
				.split("\n")
				.find((l) => l.startsWith("data:"))
				?.slice(5);
	return {
		status: res.status,
		body: json ? JSON.parse(json) : null,
		session: res.headers.get("mcp-session-id"),
	};
};

let mcpId = 0;
type Client = (
	method: string,
	params?: Record<string, unknown>,
) => Promise<Reply>;

/** The initialize-era flow: handshake, then every request on the session. */
const session = async (
	apiKey: string,
	version: "2025-11-25" | "2025-06-18",
): Promise<Client> => {
	const auth = { Authorization: `Bearer ${apiKey}` };
	const init = await post(auth, {
		jsonrpc: "2.0",
		id: ++mcpId,
		method: "initialize",
		params: {
			protocolVersion: version,
			capabilities: {},
			clientInfo: { name: "test", version: "1" },
		},
	});
	expect(init.status).toBe(200);
	expect(init.body.result.protocolVersion).toBe(version);
	const headers = {
		...auth,
		"mcp-session-id": init.session as string,
		"mcp-protocol-version": version,
	};
	await post(headers, { jsonrpc: "2.0", method: "notifications/initialized" });
	return (method, params) =>
		post(headers, { jsonrpc: "2.0", id: ++mcpId, method, params });
};

/** The 2026-07-28 flow: no handshake, every request describes itself. */
const stateless =
	(apiKey: string): Client =>
	(method, params = {}) =>
		post(
			{
				Authorization: `Bearer ${apiKey}`,
				"mcp-protocol-version": "2026-07-28",
				"mcp-method": method,
				...("name" in params ? { "mcp-name": String(params.name) } : {}),
			},
			{
				jsonrpc: "2.0",
				id: ++mcpId,
				method,
				params: {
					...params,
					_meta: {
						"io.modelcontextprotocol/protocolVersion": "2026-07-28",
						"io.modelcontextprotocol/clientCapabilities": {},
						"io.modelcontextprotocol/clientInfo": {
							name: "test",
							version: "1",
						},
					},
				},
			},
		);

const toolNames = async (client: Client) =>
	((await client("tools/list")).body.result.tools as Array<{ name: string }>)
		.map((t) => t.name)
		.sort();

const callTool = (client: Client, name: string, args: object) =>
	client("tools/call", { name, arguments: args });

// ── The door ─────────────────────────────────────────────────────────────────

/** The tool names a key of `scope` should see: one per typed operation. */
const expectedTools = (scope: "read" | "write") =>
	typedOperations
		.filter((op) => scope === "write" || op.scope === "read")
		.map((op) => op.operationId)
		.sort();

describe("the /mcp endpoint takes an API key and nothing else", () => {
	const initialize = {
		jsonrpc: "2.0",
		id: 0,
		method: "initialize",
		params: {
			protocolVersion: "2025-11-25",
			capabilities: {},
			clientInfo: { name: "test", version: "1" },
		},
	};

	test("no key is refused", async () => {
		expect((await post({}, initialize)).status).toBe(401);
	});

	test("an unknown key is refused", async () => {
		const res = await post({ Authorization: "Bearer ntr_nope" }, initialize);
		expect(res.status).toBe(401);
	});

	test("a cookie session is refused", async () => {
		expect((await post({ Cookie: owner.cookie }, initialize)).status).toBe(401);
	});
});

describe("both protocol eras on the one endpoint", () => {
	const flows: Array<[string, (apiKey: string) => Promise<Client>]> = [
		["2025-11-25 session", (k) => session(k, "2025-11-25")],
		["2025-06-18 session", (k) => session(k, "2025-06-18")],
		["2026-07-28 stateless", async (k) => stateless(k)],
	];

	for (const [flow, connect] of flows) {
		test(`${flow}: a write key lists every operation and calls one`, async () => {
			const client = await connect(writeKey);
			expect(await toolNames(client)).toEqual(expectedTools("write"));
			const res = await callTool(client, "createPage", {
				workspaceId: ws.id,
				title: `From ${flow}`,
			});
			expect(res.body.result.isError).toBe(false);
			expect(res.body.result.structuredContent).toMatchObject({
				title: `From ${flow}`,
			});
		});

		test(`${flow}: a read key lists only read tools and cannot call a write one`, async () => {
			const client = await connect(readKey);
			expect(await toolNames(client)).toEqual(expectedTools("read"));
			const res = await callTool(client, "createPage", {
				workspaceId: ws.id,
				title: "Read key write",
			});
			expect(res.body.error.code).toBe(-32602);
			const pages = await call(readKey, "GET", PAGES);
			expect(pages.body.map((p: { title: string }) => p.title)).not.toContain(
				"Read key write",
			);
		});
	}

	test("the page tools are among them", () => {
		expect(expectedTools("write")).toEqual(
			expect.arrayContaining([
				"createPage",
				"deletePage",
				"getPage",
				"listPages",
				"restorePage",
				"updatePage",
			]),
		);
		expect(expectedTools("read")).not.toContain("createPage");
	});

	test("the block, search and trash tools are listed (NOT-169.3)", async () => {
		expect(await toolNames(stateless(writeKey))).toEqual(
			expect.arrayContaining([
				"listBlocks",
				"createBlock",
				"updateBlock",
				"deleteBlock",
				"search",
				"listTrash",
			]),
		);
	});
});

describe("the MCP tool list is the operation table", () => {
	test("a write key sees exactly one tool per operation id", async () => {
		const ids = typedOperations.map((op) => op.operationId).sort();
		expect(ids.length).toBeGreaterThan(0);
		expect(await toolNames(stateless(writeKey))).toEqual(ids);
	});
});

describe("an MCP-only agent finds its workspace (NOT-169.7)", () => {
	test("read and write keys both list listWorkspaces", async () => {
		expect(await toolNames(stateless(readKey))).toContain("listWorkspaces");
		expect(await toolNames(stateless(writeKey))).toContain("listWorkspaces");
	});

	test("it returns the REST answer: only the key owner's workspaces", async () => {
		const outsider = await signUp("lister@example.com");
		await rpc(outsider.cookie, "createWorkspace", {
			name: "Elsewhere",
			slug: "elsewhere",
		});
		const res = await callTool(stateless(memberKey), "listWorkspaces", {});
		expect(res.body.result.isError).toBe(false);
		expect(res.body.result.structuredContent).toEqual([
			{ id: ws.id, name: "Mcp", slug: "mcp", role: "member" },
		]);
		const viaRest = await call(memberKey, "GET", "/api/v1/workspaces");
		expect(viaRest.status).toBe(200);
		expect(viaRest.body).toEqual(res.body.result.structuredContent);
	});

	test("a listed workspace id works in the other tools", async () => {
		const client = stateless(readKey);
		const listed = await callTool(client, "listWorkspaces", {});
		const [first] = listed.body.result.structuredContent;
		const pages = await callTool(client, "listPages", {
			workspaceId: first.id,
		});
		expect(pages.body.result.isError).toBe(false);
	});
});

describe("tool calls behave like the REST operations they are", () => {
	test("a tool result equals the REST response for the same operation", async () => {
		const client = stateless(writeKey);
		const { body: page } = await call(writeKey, "POST", PAGES, {
			title: "Same",
		});
		const viaMcp = await callTool(client, "getPage", {
			workspaceId: ws.id,
			pageId: page.id,
		});
		const viaRest = await call(readKey, "GET", `${PAGES}/${page.id}`);
		expect(viaMcp.body.result.structuredContent).toEqual(viaRest.body);

		const listed = await callTool(client, "listPages", { workspaceId: ws.id });
		expect(JSON.parse(listed.body.result.content[0].text)).toEqual(
			(await call(readKey, "GET", PAGES)).body,
		);
	});

	test("malformed arguments are a validation error naming the field", async () => {
		const res = await callTool(stateless(writeKey), "createPage", {
			workspaceId: ws.id,
			title: 42,
		});
		expect(res.body.result.isError).toBe(true);
		expect(res.body.result.content[0].text).toContain('["title"]');
	});

	test("an unknown page is a not-found error", async () => {
		const res = await callTool(stateless(writeKey), "getPage", {
			workspaceId: ws.id,
			pageId: "nope",
		});
		expect(res.body.result.isError).toBe(true);
		expect(res.body.result.content[0].text).toContain("nope");
	});

	test("a page the key owner cannot read is not readable through MCP", async () => {
		const { body: page } = await call(writeKey, "POST", PAGES, {
			title: "Private",
		});
		await rpc(
			owner.cookie,
			"writePagePermissions",
			{
				pageId: page.id,
				set: [
					{ subject: { type: "user", id: owner.userId }, relation: "owner" },
				],
				remove: [],
			},
			ws.id,
		);
		const client = stateless(memberKey);
		const res = await callTool(client, "getPage", {
			workspaceId: ws.id,
			pageId: page.id,
		});
		expect(res.body.result.isError).toBe(true);
		expect(res.body.result.structuredContent).toBeUndefined();
		expect(res.body.result.content[0].text).not.toContain("Private");

		const listed = await callTool(client, "listPages", { workspaceId: ws.id });
		expect(listed.body.result.content[0].text).not.toContain(page.id);
	});

	test("a workspace the key owner is not a member of is refused", async () => {
		const outsider = await signUp("outsider@example.com");
		const res = await callTool(
			stateless(await key(outsider.cookie, "write")),
			"listPages",
			{ workspaceId: ws.id },
		);
		expect(res.body.result.isError).toBe(true);
		expect(res.body.result.content[0].text).toContain("Not a member");
	});
});

describe("a revoked key is cut off at every door (#21)", () => {
	test("REST, a new MCP request and an open MCP session all refuse it", async () => {
		const created = await rpc<{ id: string; rawKey: string }>(
			owner.cookie,
			"createApiKey",
			{ name: "to revoke", scope: "write" },
		);
		const open = await session(created.rawKey, "2025-11-25");
		expect((await call(created.rawKey, "GET", PAGES)).status).toBe(200);
		expect(
			(await callTool(open, "listPages", { workspaceId: ws.id })).body.result
				.isError,
		).toBe(false);

		await rpc(owner.cookie, "revokeApiKey", { id: created.id });

		expect((await call(created.rawKey, "GET", PAGES)).status).toBe(401);
		const fresh = await callTool(stateless(created.rawKey), "listPages", {
			workspaceId: ws.id,
		});
		expect(fresh.status).toBe(401);
		const reused = await callTool(open, "listPages", { workspaceId: ws.id });
		expect(reused.status).toBe(401);
	});
});

describe("an agent's block edit meets the editor's lock and presence (#26)", () => {
	const BLOCKS = (pageId: string) => `${PAGES}/${pageId}/blocks`;
	const BLOCK = (blockId: string) =>
		`/api/v1/workspaces/${ws.id}/blocks/${blockId}`;

	const pageWithBlock = async (title: string) => {
		const { body: page } = await call(writeKey, "POST", PAGES, { title });
		const { body: block } = await call(writeKey, "POST", BLOCKS(page.id), {
			type: "paragraph",
			content: "before",
		});
		return { pageId: page.id as string, blockId: block.id as string };
	};

	/** The member focuses a block in the editor, which locks it for others. */
	const focus = (pageId: string, blockId: string) =>
		fetch(`${BASE}/api/presence/heartbeat`, {
			method: "POST",
			headers: { "Content-Type": "application/json", Cookie: member.cookie },
			body: JSON.stringify({
				workspaceId: ws.id,
				pageId,
				focusedBlockId: blockId,
			}),
		});

	test("REST and MCP refuse to edit or delete a block another user holds", async () => {
		const { pageId, blockId } = await pageWithBlock("Locked");
		expect((await focus(pageId, blockId)).status).toBe(200);

		const patched = await call(writeKey, "PATCH", BLOCK(blockId), {
			content: "agent",
		});
		expect(patched.status).toBe(409);
		expect((await call(writeKey, "DELETE", BLOCK(blockId))).status).toBe(409);

		const viaMcp = await callTool(stateless(writeKey), "updateBlock", {
			workspaceId: ws.id,
			blockId,
			content: "agent",
		});
		expect(viaMcp.body.result.isError).toBe(true);

		const { body: blocks } = await call(readKey, "GET", BLOCKS(pageId));
		expect(blocks.map((b: { content: string }) => b.content)).toEqual([
			"before",
		]);
	});

	test("a REST edit reaches an editor watching the page", async () => {
		const { pageId, blockId } = await pageWithBlock("Watched");
		const stream = await fetch(
			`${BASE}/api/presence/stream?workspaceId=${ws.id}&pageId=${pageId}`,
			{ headers: { Cookie: member.cookie } },
		);
		expect(stream.status).toBe(200);
		const reader = (stream.body as ReadableStream<Uint8Array>).getReader();
		let text = "";
		const seen = (async () => {
			while (!text.includes("event: block.updated")) {
				const { value, done } = await reader.read();
				if (done) return;
				text += new TextDecoder().decode(value);
			}
		})();

		await Bun.sleep(100);
		await call(writeKey, "PATCH", BLOCK(blockId), { content: "after" });
		await Promise.race([seen, Bun.sleep(3000)]);
		await reader.cancel();

		expect(text).toContain("event: block.updated");
		expect(text).toContain('"content":"after"');
	});
});
