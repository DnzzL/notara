/**
 * Members, invites and page sharing through the REST door, end to end (NA-20).
 * Same harness as rest-blocks-search-trash.test.ts.
 */

import { afterAll, describe, expect, test } from "bun:test";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PORT = 3474;
const BASE = `http://localhost:${PORT}`;
const DATA_DIR = join(tmpdir(), `notara-rest-members-${process.pid}`);

// Booted at module scope, as in route-auth.test.ts: hooks carry bun's 5s
// default timeout, and a cold runner needs longer to migrate and listen.
const server = Bun.spawn(
	["bun", join(import.meta.dir, "..", "src", "index.ts")],
	{
		env: {
			...process.env,
			PORT: String(PORT),
			DATA_DIR,
			BETTER_AUTH_SECRET: "test-secret-for-rest-members-checks-only",
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
const victim = await signUp("victim@example.com");
const other = await signUp("other@example.com");
const ws = await rpc<{ id: string }>(owner.cookie, "createWorkspace", {
	name: "Team",
	slug: "team",
});
// A second workspace, whose invite token no key of `ws` may ever reach.
const ws2 = await rpc<{ id: string }>(other.cookie, "createWorkspace", {
	name: "Other",
	slug: "other",
});
const tokenB = (
	await rpc<{ inviteToken: string }>(other.cookie, "regenerateInviteLink", {
		workspaceId: ws2.id,
	})
).inviteToken;
const joinWith = async (u: { cookie: string }, token: string) => {
	try {
		await rpc(u.cookie, "joinWorkspaceByToken", { inviteToken: token });
		return true;
	} catch {
		return false;
	}
};
const tokenA0 = (
	await rpc<{ inviteToken: string }>(owner.cookie, "regenerateInviteLink", {
		workspaceId: ws.id,
	})
).inviteToken;
await joinWith(member, tokenA0);
await joinWith(victim, tokenA0);

const key = async (cookie: string, scope: "read" | "write") =>
	(
		await rpc<{ rawKey: string }>(cookie, "createApiKey", {
			name: `${scope} key`,
			scope,
		})
	).rawKey;
const writeKey = await key(owner.cookie, "write");
const readKey = await key(owner.cookie, "read");
const memberKey = await key(member.cookie, "write"); // creator is a plain member
const WS = `/api/v1/workspaces/${ws.id}`;
const PAGES = `${WS}/pages`;

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
	return { status: res.status, text, body: text ? JSON.parse(text) : null };
};

describe("members", () => {
	test("getWorkspaceMembers: any key of a member reads it, no token in it", async () => {
		for (const k of [readKey, memberKey]) {
			const res = await call(k, "GET", `${WS}/members`);
			expect(res.status).toBe(200);
			expect(res.body.map((m: { userId: string }) => m.userId).sort()).toEqual(
				[owner.userId, member.userId, victim.userId].sort(),
			);
			expect(res.text).not.toContain(tokenA0);
			expect(res.text).not.toContain(tokenB);
		}
		expect(
			(await call(readKey, "GET", `/api/v1/workspaces/${ws2.id}/members`))
				.status,
		).toBe(403);
	});

	test("removeMember: owner's write key only; the owner cannot be removed", async () => {
		const path = `${WS}/members/${victim.userId}`;
		expect((await call(readKey, "DELETE", path)).status).toBe(403);
		expect((await call(memberKey, "DELETE", path)).status).toBe(403);
		expect(
			(await call(writeKey, "DELETE", `${WS}/members/${owner.userId}`)).status,
		).toBe(409);
		expect((await call(writeKey, "DELETE", path)).status).toBe(204);
		const list = await call(readKey, "GET", `${WS}/members`);
		expect(list.body.map((m: { userId: string }) => m.userId)).not.toContain(
			victim.userId,
		);
	});

	test("inviteMemberByEmail: owner only, returns no token or link, stays in its workspace", async () => {
		const path = `${WS}/invites/email`;
		const body = { email: "guest@example.com" };
		const ok = await call(writeKey, "POST", path, body);
		expect(ok.status).toBe(204);
		expect(ok.text).toBe("");
		expect((await call(readKey, "POST", path, body)).status).toBe(403);
		expect((await call(memberKey, "POST", path, body)).status).toBe(403);
		expect(
			(await call(writeKey, "POST", path, { email: "not-an-email" })).status,
		).toBe(422);
		// NOT-102: the other workspace's invite is out of this key's reach.
		const cross = await call(
			writeKey,
			"POST",
			`/api/v1/workspaces/${ws2.id}/invites/email`,
			body,
		);
		expect(cross.status).toBe(403);
		expect(cross.text).not.toContain(tokenB);
	});

	test("regenerateInviteLink: owner only; replaces its own token, never another workspace's", async () => {
		const path = `${WS}/invites/link`;
		expect((await call(readKey, "POST", path)).status).toBe(403);
		expect((await call(memberKey, "POST", path)).status).toBe(403);
		const cross = await call(
			writeKey,
			"POST",
			`/api/v1/workspaces/${ws2.id}/invites/link`,
		);
		expect(cross.status).toBe(403);
		expect(cross.text).not.toContain(tokenB);
		expect(await joinWith(await signUp("fresh@example.com"), tokenB)).toBe(
			true,
		);

		const res = await call(writeKey, "POST", path);
		expect(res.status).toBe(200);
		expect(res.body.inviteToken).not.toBe(tokenA0);
		expect(res.text).not.toContain(tokenB);
		// The old link is dead, the new one works.
		expect(await joinWith(await signUp("late1@example.com"), tokenA0)).toBe(
			false,
		);
		expect(
			await joinWith(await signUp("late2@example.com"), res.body.inviteToken),
		).toBe(true);
	});
});

describe("page sharing and permissions", () => {
	const newPage = async () =>
		(await call(writeKey, "POST", PAGES, { title: "Shared" })).body
			.id as string;

	test("setPageSharing / getPageShare: publish, read back, revoke", async () => {
		const id = await newPage();
		const path = `${PAGES}/${id}/share`;
		expect((await call(readKey, "GET", path)).body).toEqual({ token: null });
		expect((await call(readKey, "PUT", path, { enabled: true })).status).toBe(
			403,
		);
		const on = await call(writeKey, "PUT", path, { enabled: true });
		expect(on.status).toBe(200);
		expect(typeof on.body.token).toBe("string");
		expect((await call(readKey, "GET", path)).body).toEqual({
			token: on.body.token,
		});
		expect(
			(await call(writeKey, "PUT", path, { enabled: true })).body.token,
		).toBe(on.body.token);
		expect(
			(await call(writeKey, "PUT", path, { enabled: false })).body,
		).toEqual({
			token: null,
		});
		expect((await call(readKey, "GET", path)).body).toEqual({ token: null });
		expect((await call(writeKey, "PUT", path, { enabled: "yes" })).status).toBe(
			422,
		);
	});

	test("a viewer's key cannot read or change sharing; a stranger's key sees nothing", async () => {
		const id = await newPage();
		const perms = `${PAGES}/${id}/permissions`;
		const lock = await call(writeKey, "PUT", perms, {
			set: [
				{ subject: { type: "user", id: member.userId }, relation: "viewer" },
			],
			remove: [],
		});
		expect(lock.status).toBe(200);
		const share = `${PAGES}/${id}/share`;
		expect((await call(memberKey, "GET", share)).status).toBe(403);
		expect(
			(await call(memberKey, "PUT", share, { enabled: true })).status,
		).toBe(403);
		const outsider = await key(
			(await signUp("outsider@example.com")).cookie,
			"write",
		);
		expect((await call(outsider, "GET", share)).status).toBe(403);
		expect((await call(outsider, "GET", perms)).status).toBe(403);
	});

	test("writePagePermissions / getPagePermissions: page owner's write key only", async () => {
		const id = await newPage();
		const path = `${PAGES}/${id}/permissions`;
		const before = await call(readKey, "GET", path);
		expect(before.status).toBe(200);
		const entry = {
			subject: { type: "user", id: member.userId },
			relation: "viewer",
		};
		expect(
			(await call(readKey, "PUT", path, { set: [entry], remove: [] })).status,
		).toBe(403);
		const write = await call(writeKey, "PUT", path, {
			set: [entry],
			remove: [],
			ifRevision: before.body.revision,
		});
		expect(write.status).toBe(200);
		const after = await call(readKey, "GET", path);
		expect(after.body.direct).toContainEqual(entry);
		expect(after.body.revision).toBe(write.body.revision);
		// A viewer reads the list but cannot widen their own access.
		expect((await call(memberKey, "GET", path)).status).toBe(200);
		const grab = {
			subject: { type: "user", id: member.userId },
			relation: "owner",
		};
		expect(
			(await call(memberKey, "PUT", path, { set: [grab], remove: [] })).status,
		).toBe(403);
		// Stale revision is refused.
		const stale = await call(writeKey, "PUT", path, {
			set: [],
			remove: [{ subject: entry.subject }],
			ifRevision: before.body.revision,
		});
		expect(stale.status).toBeGreaterThanOrEqual(400);
		expect(stale.status).toBeLessThan(500);
	});
});
