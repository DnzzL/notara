/**
 * Who made the last edit (NOT-174, ADR-013), through the real doors: a UI edit
 * (RPC, cookie) is the user; a REST edit (API key) is the key, by the name it
 * had at the time. The stamp survives a rename and a revoke, and never carries
 * the secret or its hash.
 */

import { Database } from "bun:sqlite";
import { afterAll, describe, expect, test } from "bun:test";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sha256 } from "../src/api-v1/auth.js";
import { bootServer } from "./boot-server.js";

const DATA_DIR = join(tmpdir(), `notara-updated-by-${process.pid}`);
const { proc: server, base: BASE } = await bootServer((base) => ({
	DATA_DIR,
	BETTER_AUTH_SECRET: "test-secret-for-updated-by-checks-only",
	BETTER_AUTH_URL: base,
	ADMIN_EMAILS: "",
}));
afterAll(() => {
	server?.kill();
	rmSync(DATA_DIR, { recursive: true, force: true });
});

const signRes = await fetch(`${BASE}/api/auth/sign-up/email`, {
	method: "POST",
	headers: { "Content-Type": "application/json", Origin: BASE },
	body: JSON.stringify({
		email: "ed@example.com",
		password: "correct-horse-1",
		name: "Ed",
	}),
});
const cookie = signRes.headers
	.getSetCookie()
	.map((c) => c.split(";")[0])
	.join("; ");
const userId = ((await signRes.json()) as { user: { id: string } }).user.id;

let rpcId = 0;
const rpc = async <T>(tag: string, payload: unknown, workspaceId?: string) => {
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

const ws = await rpc<{ id: string }>("createWorkspace", {
	name: "Edits",
	slug: "edits",
});
const created = await rpc<{ id: string; rawKey: string }>("createApiKey", {
	name: "agent-one",
	scope: "write",
});
const KEY = created.rawKey;
const API = `/api/v1/workspaces/${ws.id}`;

const rest = async (method: string, path: string, body?: unknown) => {
	const res = await fetch(`${BASE}${API}${path}`, {
		method,
		headers: {
			Authorization: `Bearer ${KEY}`,
			"Content-Type": "application/json",
		},
		body: body === undefined ? undefined : JSON.stringify(body),
	});
	const text = await res.text();
	return { status: res.status, text, json: text ? JSON.parse(text) : null };
};

const wsDb = () =>
	new Database(join(DATA_DIR, "workspaces", `${ws.id}.db`), { readonly: true });
const stamp = (table: "pages" | "blocks", id: string) =>
	wsDb()
		.query(
			`SELECT updated_by, updated_by_key_id, updated_by_key_name FROM ${table} WHERE id = ?`,
		)
		.get(id);

describe("updated_by", () => {
	let pageId: string;
	let blockId: string;

	test("a REST edit records the key id and a name snapshot, on page and block", async () => {
		const page = await rest("POST", "/pages", { title: "Doc" });
		pageId = page.json.id;
		const block = await rest("POST", `/pages/${pageId}/blocks`, {
			type: "paragraph",
			content: "<p>hi</p>",
		});
		blockId = block.json.id;

		const expected = {
			updated_by: userId,
			updated_by_key_id: created.id,
			updated_by_key_name: "agent-one",
		};
		expect(stamp("pages", pageId)).toEqual(expected);
		expect(stamp("blocks", blockId)).toEqual(expected);
		expect((await rest("GET", `/pages/${pageId}`)).json).toMatchObject({
			updatedBy: userId,
			updatedByKeyName: "agent-one",
		});
	});

	test("a UI edit stays attributed to the user, with no key", async () => {
		await rpc("updatePage", { id: pageId, title: "Doc 2" }, ws.id);
		await rpc("updateBlock", { id: blockId, content: "<p>ui</p>" }, ws.id);
		const expected = {
			updated_by: userId,
			updated_by_key_id: null,
			updated_by_key_name: null,
		};
		expect(stamp("pages", pageId)).toEqual(expected);
		expect(stamp("blocks", blockId)).toEqual(expected);
	});

	test("renaming or revoking the key keeps the stored name", async () => {
		await rest("PATCH", `/blocks/${blockId}`, { content: "<p>again</p>" });
		const platform = new Database(join(DATA_DIR, "platform.db"));
		platform
			.query("UPDATE api_keys SET name = 'renamed' WHERE id = ?")
			.run(created.id);
		expect(stamp("pages", pageId)).toMatchObject({
			updated_by_key_name: "agent-one",
		});

		await rpc("revokeApiKey", { id: created.id });
		expect(stamp("pages", pageId)).toMatchObject({
			updated_by_key_id: created.id,
			updated_by_key_name: "agent-one",
		});
		const page = await rpc<{ updatedByKeyName: string }>(
			"getPage",
			{ id: pageId },
			ws.id,
		);
		expect(page.updatedByKeyName).toBe("agent-one");
	});

	test("the secret and its hash are nowhere in the stored or returned data", async () => {
		const dump = JSON.stringify([
			wsDb().query("SELECT * FROM pages").all(),
			wsDb().query("SELECT * FROM blocks").all(),
			await rpc("getPage", { id: pageId }, ws.id),
		]);
		expect(dump).not.toContain(KEY);
		expect(dump).not.toContain(sha256(KEY));
	});
});
