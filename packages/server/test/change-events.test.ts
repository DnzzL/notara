/**
 * Change events (NOT-183, ADR-015), end to end: subscribe over SSE with an API
 * key, edit through REST and through the UI's RPC door, receive the event.
 * Same harness as key-subtree.test.ts.
 */

import { afterAll, describe, expect, test } from "bun:test";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { bootServer } from "./boot-server.js";

const DATA_DIR = join(tmpdir(), `notara-change-events-${process.pid}`);

const { proc: server, base: BASE } = await bootServer((base) => ({
	DATA_DIR,
	BETTER_AUTH_SECRET: "test-secret-for-change-events-only",
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

type Change = {
	kind: string;
	op: string;
	id: string;
	pageId: string;
	updatedBy: string;
};

/** Open the stream; `next` resolves with the next change event or rejects after 3s. */
const listen = async (headers: Record<string, string>) => {
	const ctrl = new AbortController();
	const res = await fetch(`${BASE}${EVENTS}`, {
		headers,
		signal: ctrl.signal,
	});
	if (res.status !== 200) return { status: res.status, next: null, close() {} };
	const reader = res.body!.getReader();
	const decoder = new TextDecoder();
	let buffer = "";
	const next = async (): Promise<Change> => {
		const deadline = Date.now() + 3000;
		while (Date.now() < deadline) {
			const frame = buffer.indexOf("\n\n");
			if (frame >= 0) {
				const raw = buffer.slice(0, frame);
				buffer = buffer.slice(frame + 2);
				const data = raw.split("\n").find((l) => l.startsWith("data: "));
				if (data?.includes('"type":"change"')) return JSON.parse(data.slice(6));
				continue;
			}
			const chunk = await Promise.race([
				reader.read(),
				Bun.sleep(deadline - Date.now()).then(() => null),
			]);
			if (chunk?.value) buffer += decoder.decode(chunk.value);
		}
		throw new Error("no event within 3s");
	};
	return { status: 200, next, close: () => ctrl.abort() };
};

const cookie = await signUp("owner@example.com");
const ws = await rpc<{ id: string }>(cookie, "createWorkspace", {
	name: "Events",
	slug: "events",
});
const WS = `/api/v1/workspaces/${ws.id}`;
const EVENTS = `${WS}/events`;
const PAGES = `${WS}/pages`;

const keyOf = async (name: string, rootPageId?: string) =>
	(
		await rpc<{ rawKey: string }>(
			cookie,
			"createApiKey",
			{ name, scope: "write", ...(rootPageId ? { rootPageId } : {}) },
			ws.id,
		)
	).rawKey;

const all = await keyOf("all");
const bearer = (k: string) => ({ Authorization: `Bearer ${k}` });

describe("GET /workspaces/:id/events", () => {
	test("needs a credential", async () => {
		expect((await listen({})).status).toBe(401);
	});

	test("an API key subscriber receives the event of a REST edit", async () => {
		const stream = await listen(bearer(all));
		const created = await call(all, "POST", PAGES, { title: "Hello" });
		const event = await stream.next!();
		expect(event).toMatchObject({
			kind: "page",
			op: "create",
			id: created.body.id,
			pageId: created.body.id,
		});
		expect(event.updatedBy).toBeString();

		const block = await call(
			all,
			"POST",
			`${PAGES}/${created.body.id}/blocks`,
			{
				type: "paragraph",
				content: "<p>x</p>",
				index: 0,
			},
		);
		expect(await stream.next!()).toMatchObject({
			kind: "block",
			op: "create",
			id: block.body.id,
			pageId: created.body.id,
		});

		await call(
			all,
			"DELETE",
			`/api/v1/workspaces/${ws.id}/blocks/${block.body.id}`,
		);
		expect(await stream.next!()).toMatchObject({
			kind: "block",
			op: "delete",
			id: block.body.id,
			pageId: created.body.id,
		});
		stream.close();
	});

	test("an edit made by the UI (RPC, session) is emitted too", async () => {
		const stream = await listen(bearer(all));
		const page = await rpc<{ id: string }>(
			cookie,
			"createPage",
			{ title: "From the UI", parentId: null },
			ws.id,
		);
		expect(await stream.next!()).toMatchObject({
			kind: "page",
			op: "create",
			id: page.id,
		});
		const block = await rpc<{ id: string }>(
			cookie,
			"createBlock",
			{
				pageId: page.id,
				type: "paragraph",
				content: "<p>a</p>",
				index: 0,
				parentId: null,
			},
			ws.id,
		);
		await stream.next!();
		await rpc(
			cookie,
			"updateBlock",
			{ id: block.id, content: "<p>b</p>" },
			ws.id,
		);
		expect(await stream.next!()).toMatchObject({
			kind: "block",
			op: "update",
			id: block.id,
			pageId: page.id,
		});
		stream.close();
	});

	test("a key limited to a subtree hears nothing outside it", async () => {
		const root = (await call(all, "POST", PAGES, { title: "Root" })).body;
		const outside = (await call(all, "POST", PAGES, { title: "Outside" })).body;
		const scoped = await keyOf("scoped", root.id);

		const stream = await listen(bearer(scoped));
		await call(all, "PATCH", `${PAGES}/${outside.id}`, { title: "Nope" });
		await call(all, "PATCH", `${PAGES}/${root.id}`, { title: "Yes" });

		// Delivery is ordered: had the outside edit leaked, it would arrive first.
		expect(await stream.next!()).toMatchObject({
			kind: "page",
			op: "update",
			id: root.id,
		});
		stream.close();
	});
});
