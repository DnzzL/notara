/**
 * The block, search and trash operations through the REST door, end to end
 * (NOT-169.3). Same harness as rest-pages.test.ts: booted server, real SQLite
 * workspace, real API keys.
 */

import { afterAll, describe, expect, test } from "bun:test";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PORT = 3471;
const BASE = `http://localhost:${PORT}`;
const DATA_DIR = join(tmpdir(), `notara-rest-blocks-${process.pid}`);

// Booted at module scope, as in route-auth.test.ts: hooks carry bun's 5s
// default timeout, and a cold runner needs longer to migrate and listen.
const server = Bun.spawn(
	["bun", join(import.meta.dir, "..", "src", "index.ts")],
	{
		env: {
			...process.env,
			PORT: String(PORT),
			DATA_DIR,
			BETTER_AUTH_SECRET: "test-secret-for-rest-blocks-checks-only",
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
	name: "Blocks",
	slug: "blocks",
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

/** A page only its creator (the owner) can see. */
const lockedPage = async () => {
	const { body: page } = await call(writeKey, "POST", PAGES, {
		title: "Private",
	});
	await rpc(
		owner.cookie,
		"writePagePermissions",
		{
			pageId: page.id,
			set: [{ subject: { type: "user", id: owner.userId }, relation: "owner" }],
			remove: [],
		},
		ws.id,
	);
	return page.id as string;
};

const WS = `/api/v1/workspaces/${ws.id}`;
const blocksOf = (pageId: string) => `${PAGES}/${pageId}/blocks`;
const newPage = async (title: string) =>
	(await call(writeKey, "POST", PAGES, { title })).body.id as string;

// ── Blocks ───────────────────────────────────────────────────────────────────

describe("block operations through REST", () => {
	test("create, list, update and delete a block", async () => {
		const pageId = await newPage("Blocks");
		const created = await call(writeKey, "POST", blocksOf(pageId), {
			type: "paragraph",
			content: "<p>hi</p>",
			index: 0,
		});
		expect(created.status).toBe(201);
		expect(created.body).toEqual({
			id: created.body.id,
			pageId,
			type: "paragraph",
			content: "<p>hi</p>",
			parentId: null,
			index: 0,
		});

		const listed = await call(readKey, "GET", blocksOf(pageId));
		expect(listed).toEqual({ status: 200, body: [created.body] });

		const updated = await call(
			writeKey,
			"PATCH",
			`${WS}/blocks/${created.body.id}`,
			{ content: "<p>bye</p>" },
		);
		expect(updated).toEqual({
			status: 200,
			body: { ...created.body, content: "<p>bye</p>" },
		});

		const deleted = await call(
			writeKey,
			"DELETE",
			`${WS}/blocks/${created.body.id}`,
		);
		expect(deleted.status).toBe(204);
		expect((await call(readKey, "GET", blocksOf(pageId))).body).toEqual([]);
	});
});

describe("malformed block requests are refused with 422 naming the field", () => {
	test("createBlock without a type", async () => {
		const pageId = await newPage("x");
		const res = await call(writeKey, "POST", blocksOf(pageId), {
			content: "<p></p>",
		});
		expect(res.status).toBe(422);
		expect(res.body.error).toContain("type");
	});

	test("createBlock with an unknown type", async () => {
		const pageId = await newPage("x");
		const res = await call(writeKey, "POST", blocksOf(pageId), {
			type: "banner",
			content: "<p></p>",
		});
		expect(res.status).toBe(422);
		expect(res.body.error).toContain("type");
	});

	test("createBlock with object content", async () => {
		const pageId = await newPage("x");
		const res = await call(writeKey, "POST", blocksOf(pageId), {
			type: "paragraph",
			content: { text: "hi" },
		});
		expect(res.status).toBe(422);
		expect(res.body.error).toContain("content");
	});

	test("updateBlock without content", async () => {
		const pageId = await newPage("x");
		const { body: block } = await call(writeKey, "POST", blocksOf(pageId), {
			type: "paragraph",
			content: "<p></p>",
		});
		const res = await call(writeKey, "PATCH", `${WS}/blocks/${block.id}`, {});
		expect(res.status).toBe(422);
		expect(res.body.error).toContain("content");
	});
});

describe("unknown and forbidden blocks", () => {
	test("an unknown block id is a 404 on update and on delete", async () => {
		const update = await call(writeKey, "PATCH", `${WS}/blocks/nope`, {
			content: "<p></p>",
		});
		expect(update.status).toBe(404);
		expect((await call(writeKey, "DELETE", `${WS}/blocks/nope`)).status).toBe(
			404,
		);
	});

	test("an unknown page id is a 404 on list and on create", async () => {
		expect((await call(readKey, "GET", blocksOf("nope"))).status).toBe(404);
		const create = await call(writeKey, "POST", blocksOf("nope"), {
			type: "paragraph",
			content: "<p></p>",
		});
		expect(create.status).toBe(404);
	});

	test("blocks of a page the caller cannot access are refused, and left untouched", async () => {
		const pageId = await lockedPage();
		const { body: block } = await call(writeKey, "POST", blocksOf(pageId), {
			type: "paragraph",
			content: "<p>secret</p>",
		});
		const attempts = [
			await call(memberKey, "GET", blocksOf(pageId)),
			await call(memberKey, "POST", blocksOf(pageId), {
				type: "paragraph",
				content: "<p>pwned</p>",
			}),
			await call(memberKey, "PATCH", `${WS}/blocks/${block.id}`, {
				content: "<p>pwned</p>",
			}),
			await call(memberKey, "DELETE", `${WS}/blocks/${block.id}`),
		];
		expect(attempts.map((r) => r.status)).toEqual([403, 403, 403, 403]);
		expect((await call(readKey, "GET", blocksOf(pageId))).body).toEqual([
			block,
		]);
	});

	test("a read key cannot run a write block operation", async () => {
		const pageId = await newPage("x");
		const { body: block } = await call(writeKey, "POST", blocksOf(pageId), {
			type: "paragraph",
			content: "<p>kept</p>",
		});
		const attempts = [
			await call(readKey, "POST", blocksOf(pageId), {
				type: "paragraph",
				content: "<p>nope</p>",
			}),
			await call(readKey, "PATCH", `${WS}/blocks/${block.id}`, {
				content: "<p>nope</p>",
			}),
			await call(readKey, "DELETE", `${WS}/blocks/${block.id}`),
		];
		expect(attempts.map((r) => r.status)).toEqual([403, 403, 403]);
		expect((await call(readKey, "GET", blocksOf(pageId))).body).toEqual([
			block,
		]);
	});
});

// ── Search ───────────────────────────────────────────────────────────────────

describe("search through REST", () => {
	test("a read key finds pages and blocks it may see, not the others", async () => {
		const open = await newPage("Zebrafish notes");
		await call(writeKey, "POST", blocksOf(open), {
			type: "paragraph",
			content: "<p>zebrafish husbandry</p>",
		});
		const locked = await lockedPage();
		await call(writeKey, "POST", blocksOf(locked), {
			type: "paragraph",
			content: "<p>zebrafish secrets</p>",
		});

		const mine = await call(readKey, "GET", `${WS}/search?q=zebrafish`);
		expect(mine.status).toBe(200);
		expect(mine.body).toContainEqual({
			type: "page",
			id: open,
			title: "Zebrafish notes",
			content: "",
			pageId: open,
		});
		expect(mine.body.map((r: { pageId: string }) => r.pageId)).toContain(
			locked,
		);

		const theirs = await call(memberKey, "GET", `${WS}/search?q=zebrafish`);
		expect(theirs.status).toBe(200);
		const pagesSeen = theirs.body.map((r: { pageId: string }) => r.pageId);
		expect(pagesSeen).toContain(open);
		expect(pagesSeen).not.toContain(locked);
	});

	test("a search without a query is a 422 naming q", async () => {
		for (const qs of ["", "?q=", "?q=%20%20"]) {
			const res = await call(readKey, "GET", `${WS}/search${qs}`);
			expect(res.status).toBe(422);
			expect(res.body.error).toContain(`"q"`);
		}
	});
});

// ── Trash ────────────────────────────────────────────────────────────────────

describe("trash through REST", () => {
	test("a read key lists a trashed page", async () => {
		const id = await newPage("Binned");
		await call(writeKey, "DELETE", `${PAGES}/${id}`);
		const res = await call(readKey, "GET", `${WS}/trash`);
		expect(res.status).toBe(200);
		expect(Object.keys(res.body).sort()).toEqual([
			"databases",
			"pages",
			"records",
		]);
		expect(res.body.pages).toContainEqual({
			id,
			title: "Binned",
			deletedAt: expect.any(String),
		});
	});
});
