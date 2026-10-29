/**
 * The trash lists only what the caller can read, through every door that
 * reaches it (RPC and REST). A page locked to one member, trashed along with a
 * database and a record under it, stays out of another member's trash.
 */

import { afterAll, describe, expect, test } from "bun:test";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PORT = 3472;
const BASE = `http://localhost:${PORT}`;
const DATA_DIR = join(tmpdir(), `notara-trash-visibility-${process.pid}`);

const server = Bun.spawn(
	["bun", join(import.meta.dir, "..", "src", "index.ts")],
	{
		env: {
			...process.env,
			PORT: String(PORT),
			DATA_DIR,
			BETTER_AUTH_SECRET: "test-secret-for-trash-visibility-only",
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

type Trash = {
	pages: { id: string }[];
	databases: { id: string }[];
	records: { id: string }[];
};
const ids = (t: Trash) => ({
	pages: t.pages.map((p) => p.id),
	databases: t.databases.map((d) => d.id),
	records: t.records.map((r) => r.id),
});

// ── Fixture: workspace owner, two plain members A and B ──────────────────────

const owner = await signUp("owner@example.com");
const alice = await signUp("alice@example.com");
const bob = await signUp("bob@example.com");
const ws = await rpc<{ id: string }>(owner.cookie, "createWorkspace", {
	name: "Trash",
	slug: "trash",
});
const { inviteToken } = await rpc<{ inviteToken: string }>(
	owner.cookie,
	"regenerateInviteLink",
	{ workspaceId: ws.id },
);
await rpc(alice.cookie, "joinWorkspaceByToken", { inviteToken });
await rpc(bob.cookie, "joinWorkspaceByToken", { inviteToken });

const asAlice = <T>(tag: string, payload: unknown) =>
	rpc<T>(alice.cookie, tag, payload, ws.id);

// Alice's private page, a database on it with one record, and a sub-page.
const secret = await asAlice<{ id: string }>("createPage", {
	title: "Secret",
	parentId: null,
});
await rpc(
	owner.cookie,
	"writePagePermissions",
	{
		pageId: secret.id,
		set: [{ subject: { type: "user", id: alice.userId }, relation: "owner" }],
		remove: [],
	},
	ws.id,
);
const child = await asAlice<{ id: string }>("createPage", {
	title: "Secret child",
	parentId: secret.id,
});
const db = await asAlice<{ id: string }>("createDatabase", {
	pageId: secret.id,
	name: "Secret db",
});
const otherDb = await asAlice<{ id: string }>("createDatabase", {
	pageId: secret.id,
	name: "Secret db 2",
});
const record = await asAlice<{ id: string }>("createRecord", {
	databaseId: otherDb.id,
	title: "Secret record",
});
// A page everyone can read, trashed too: the filter must not empty the trash.
const open = await asAlice<{ id: string }>("createPage", {
	title: "Open",
	parentId: null,
});

await asAlice("deleteRecord", { id: record.id });
await asAlice("deleteDatabase", { id: db.id });
await asAlice("deletePage", { id: child.id });
await asAlice("deletePage", { id: secret.id });
await asAlice("deletePage", { id: open.id });

const restKey = async (cookie: string) =>
	(
		await rpc<{ rawKey: string }>(
			cookie,
			"createApiKey",
			{ name: "read", scope: "read" },
			ws.id,
		)
	).rawKey;

const restTrash = async (cookie: string) => {
	const res = await fetch(`${BASE}/api/v1/workspaces/${ws.id}/trash`, {
		headers: { Authorization: `Bearer ${await restKey(cookie)}` },
	});
	expect(res.status).toBe(200);
	return (await res.json()) as Trash;
};

const doors = {
	RPC: (cookie: string) => rpc<Trash>(cookie, "listTrash", null, ws.id),
	REST: restTrash,
};

for (const [door, listTrash] of Object.entries(doors)) {
	describe(`listTrash through ${door}`, () => {
		test("a member without access sees none of the private subtree", async () => {
			const trash = ids(await listTrash(bob.cookie));
			expect(trash.pages).toEqual([open.id]);
			expect(trash.databases).toEqual([]);
			expect(trash.records).toEqual([]);
		});

		test("the private page's owner still sees all of it", async () => {
			const trash = ids(await listTrash(alice.cookie));
			expect(trash.pages.sort()).toEqual([child.id, secret.id, open.id].sort());
			expect(trash.databases).toEqual([db.id]);
			expect(trash.records).toEqual([record.id]);
		});
	});
}
