/**
 * The page operations through the REST door, end to end (NOT-169.1).
 *
 * Booted server, real SQLite workspace, real API keys: the only way to see the
 * door decode input, enforce the declared scope, check the page ACL and map
 * each tagged error to its status — all of which are wiring, not handler logic.
 */

import { afterAll, describe, expect, test } from "bun:test";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PORT = 3458;
const BASE = `http://localhost:${PORT}`;
const DATA_DIR = join(tmpdir(), `notara-rest-pages-${process.pid}`);

// Booted at module scope, as in route-auth.test.ts: hooks carry bun's 5s
// default timeout, and a cold runner needs longer to migrate and listen.
const server = Bun.spawn(
	["bun", join(import.meta.dir, "..", "src", "index.ts")],
	{
		env: {
			...process.env,
			PORT: String(PORT),
			DATA_DIR,
			BETTER_AUTH_SECRET: "test-secret-for-rest-pages-checks-only",
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
	name: "Pages",
	slug: "pages",
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

// ── The page operations ──────────────────────────────────────────────────────

describe("page operations through REST", () => {
	test("create, read, update, trash, restore and list a page", async () => {
		const created = await call(writeKey, "POST", PAGES, { title: "Notes" });
		expect(created.status).toBe(201);
		expect(created.body).toMatchObject({
			title: "Notes",
			parentId: null,
			isDeleted: false,
		});
		const id = created.body.id as string;

		const got = await call(readKey, "GET", `${PAGES}/${id}`);
		expect(got.status).toBe(200);
		expect(got.body).toEqual(created.body);

		const updated = await call(writeKey, "PATCH", `${PAGES}/${id}`, {
			title: "Renamed",
			isFavorite: true,
		});
		expect(updated.status).toBe(200);
		expect(updated.body).toMatchObject({ title: "Renamed", isFavorite: true });

		expect((await call(writeKey, "DELETE", `${PAGES}/${id}`)).status).toBe(204);
		expect((await call(readKey, "GET", `${PAGES}/${id}`)).status).toBe(404);

		const restored = await call(writeKey, "POST", `${PAGES}/${id}/restore`);
		expect(restored).toEqual({ status: 200, body: { restored: true } });

		const listed = await call(readKey, "GET", PAGES);
		expect(listed.status).toBe(200);
		expect(listed.body.map((p: { id: string }) => p.id)).toContain(id);
	});

	test("a permanent delete purges the page", async () => {
		const { body: page } = await call(writeKey, "POST", PAGES, {
			title: "Gone",
		});
		const res = await call(
			writeKey,
			"DELETE",
			`${PAGES}/${page.id}?permanent=true`,
		);
		expect(res.status).toBe(204);
		const restore = await call(writeKey, "POST", `${PAGES}/${page.id}/restore`);
		expect(restore.body).toEqual({ restored: false });
	});
});

describe("malformed page requests are refused with 422 naming the field", () => {
	test("createPage without a title", async () => {
		const res = await call(writeKey, "POST", PAGES, { parentId: null });
		expect(res.status).toBe(422);
		expect(res.body.error).toContain("title");
	});

	test("updatePage with a title that is not a string", async () => {
		const { body: page } = await call(writeKey, "POST", PAGES, { title: "x" });
		const res = await call(writeKey, "PATCH", `${PAGES}/${page.id}`, {
			title: 42,
		});
		expect(res.status).toBe(422);
		expect(res.body.error).toContain("title");
	});

	test("deletePage with a permanent flag that is not a boolean", async () => {
		const { body: page } = await call(writeKey, "POST", PAGES, { title: "x" });
		const res = await call(
			writeKey,
			"DELETE",
			`${PAGES}/${page.id}?permanent=maybe`,
		);
		expect(res.status).toBe(422);
		expect(res.body.error).toContain("permanent");
	});
});

describe("unknown and forbidden pages", () => {
	test("an unknown page id is a 404 on read and on update", async () => {
		expect((await call(readKey, "GET", `${PAGES}/nope`)).status).toBe(404);
		expect(
			(await call(writeKey, "PATCH", `${PAGES}/nope`, { title: "t" })).status,
		).toBe(404);
	});

	test("a page the caller cannot access is refused, and left untouched", async () => {
		const id = await lockedPage();
		expect((await call(memberKey, "GET", `${PAGES}/${id}`)).status).toBe(403);
		expect(
			(await call(memberKey, "PATCH", `${PAGES}/${id}`, { title: "pwned" }))
				.status,
		).toBe(403);
		expect((await call(memberKey, "DELETE", `${PAGES}/${id}`)).status).toBe(
			403,
		);
		const list = await call(memberKey, "GET", PAGES);
		expect(list.body.map((p: { id: string }) => p.id)).not.toContain(id);
		expect((await call(readKey, "GET", `${PAGES}/${id}`)).body.title).toBe(
			"Private",
		);
	});
});

describe("each page operation runs under its declared scope", () => {
	test("a read key runs read page operations", async () => {
		expect((await call(readKey, "GET", PAGES)).status).toBe(200);
	});

	test("a read key cannot run a write page operation", async () => {
		const { body: page } = await call(writeKey, "POST", PAGES, { title: "x" });
		const attempts = [
			await call(readKey, "POST", PAGES, { title: "nope" }),
			await call(readKey, "PATCH", `${PAGES}/${page.id}`, { title: "nope" }),
			await call(readKey, "DELETE", `${PAGES}/${page.id}`),
			await call(readKey, "POST", `${PAGES}/${page.id}/restore`),
		];
		expect(attempts.map((r) => r.status)).toEqual([403, 403, 403, 403]);
		expect((await call(readKey, "GET", `${PAGES}/${page.id}`)).body.title).toBe(
			"x",
		);
	});
});

describe("the other REST operations keep working", () => {
	test("blocks on a page are listed and created as before", async () => {
		const { body: page } = await call(writeKey, "POST", PAGES, { title: "b" });
		const blocks = `${PAGES}/${page.id}/blocks`;
		const created = await call(writeKey, "POST", blocks, {
			type: "paragraph",
			content: "<p>hi</p>",
		});
		expect(created.status).toBe(201);
		const listed = await call(readKey, "GET", blocks);
		expect(listed.status).toBe(200);
		expect(listed.body.map((b: { id: string }) => b.id)).toContain(
			created.body.id,
		);
	});
});
