/**
 * An admin route honours the scope of the key that calls it.
 *
 * A key authenticates as its owner, and an admin's key passes the admin gate.
 * The gate must also ask what the key may do: a read key reads the admin
 * routes and is refused the ones that change the instance. Booted end to end
 * because the bug was wiring — the gate never saw the scope.
 */

import { afterAll, describe, expect, test } from "bun:test";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SCOPE_REFUSAL } from "../src/api-v1/scope.js";

const PORT = 3481;
const BASE = `http://localhost:${PORT}`;
const DATA_DIR = join(tmpdir(), `notara-admin-scope-${process.pid}`);
const ADMIN = "admin@example.com";

const server = Bun.spawn(
	["bun", join(import.meta.dir, "..", "src", "index.ts")],
	{
		env: {
			...process.env,
			PORT: String(PORT),
			DATA_DIR,
			BETTER_AUTH_SECRET: "test-secret-for-admin-scope-checks-only",
			BETTER_AUTH_URL: BASE,
			ADMIN_EMAILS: ADMIN,
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

const res = await fetch(`${BASE}/api/auth/sign-up/email`, {
	method: "POST",
	headers: { "Content-Type": "application/json", Origin: BASE },
	body: JSON.stringify({
		email: ADMIN,
		password: "correct-horse-1",
		name: "A",
	}),
});
if (!res.ok) throw new Error(`sign-up: ${await res.text()}`);
const cookie = res.headers
	.getSetCookie()
	.map((c) => c.split(";")[0])
	.join("; ");

const key = async (scope: "read" | "write") => {
	const r = await fetch(`${BASE}/api`, {
		method: "POST",
		headers: { "Content-Type": "application/json", Cookie: cookie },
		body: JSON.stringify({
			_tag: "Request",
			id: scope,
			tag: "createApiKey",
			payload: { name: `${scope} key`, scope },
			headers: [],
		}),
	});
	const messages = (await r.json()) as Array<{
		_tag: string;
		exit?: { _tag: string; value?: { rawKey: string } };
	}>;
	const exit = messages.find((m) => m._tag === "Exit");
	if (exit?.exit?._tag !== "Success")
		throw new Error(`createApiKey: ${JSON.stringify(messages)}`);
	return { Authorization: `Bearer ${exit.exit.value!.rawKey}` };
};
const readKey = await key("read");
const writeKey = await key("write");

const call = (method: string, path: string, headers: Record<string, string>) =>
	fetch(`${BASE}${path}`, {
		method,
		headers,
		body: method === "GET" ? undefined : "{}",
		signal: AbortSignal.timeout(5000),
	});

describe("an admin's read key", () => {
	for (const [method, path] of [
		["POST", "/api/settings"],
		["POST", "/api/backup/trigger"],
		["POST", "/api/backup/restore"],
		["DELETE", "/api/admin/users/someone"],
	] as const) {
		test(`is refused ${method} ${path}`, async () => {
			const r = await call(method, path, readKey);
			expect(r.status).toBe(403);
			expect(((await r.json()) as { error: string }).error).toBe(SCOPE_REFUSAL);
		});
	}

	test("still lists users", async () => {
		expect((await call("GET", "/api/admin/users", readKey)).status).toBe(200);
	});
});

describe("an admin's write key and cookie session pass the gate", () => {
	// An empty body stops restore at its own validation, past the gate, so no
	// restore ever runs.
	for (const [who, headers] of [
		["write key", writeKey],
		["cookie", { Cookie: cookie }],
	] as const) {
		test(`${who}: restore reaches its validation`, async () => {
			expect((await call("POST", "/api/backup/restore", headers)).status).toBe(
				400,
			);
		});

		test(`${who}: deletes a user's memberships`, async () => {
			expect(
				(await call("DELETE", "/api/admin/users/someone", headers)).status,
			).toBe(200);
		});
	}
});
