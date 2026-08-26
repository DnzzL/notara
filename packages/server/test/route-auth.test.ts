/**
 * Guard against unauthenticated HTTP routes.
 *
 * Every non-public route must refuse an anonymous caller. This is deliberately
 * an end-to-end test against a booted server rather than a handler unit test:
 * the bugs this exists to catch (GET/POST /api/settings, POST
 * /api/backup/trigger, POST /api/upload, POST /import-notion, GET
 * /api/stream/view-config) were all wiring mistakes. Every handler involved was
 * fine on its own — the route simply never had a guard attached, so no
 * handler-level test could have seen it.
 *
 * Adding a route means adding a line here.
 */

import { afterAll, describe, expect, test } from "bun:test";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PORT = 3457;
const BASE = `http://localhost:${PORT}`;
const DATA_DIR = join(tmpdir(), `notara-route-auth-${process.pid}`);

// Booted at module scope rather than in beforeAll: hooks carry bun's 5s default
// timeout, and a cold CI runner needs longer than that to migrate and listen.
const server = Bun.spawn(
	["bun", join(import.meta.dir, "..", "src", "index.ts")],
	{
		env: {
			...process.env,
			PORT: String(PORT),
			DATA_DIR,
			BETTER_AUTH_SECRET: "test-secret-for-route-auth-checks-only",
			// Admin deliberately unconfigured: requireAdmin must then close, not open.
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
	// Surface the server's own output; an opaque timeout is undebuggable in CI.
	const stderr = await new Response(server.stderr as ReadableStream).text();
	server.kill();
	throw new Error(`server did not come up in 30s:\n${stderr}`);
}

afterAll(() => {
	server?.kill();
	rmSync(DATA_DIR, { recursive: true, force: true });
});

/** Fetch with a hard timeout so an unguarded SSE route fails instead of hanging. */
const call = (
	method: string,
	path: string,
	headers: Record<string, string> = {},
) =>
	fetch(`${BASE}${path}`, {
		method,
		headers,
		body: method === "GET" ? undefined : "{}",
		signal: AbortSignal.timeout(5000),
	});

const WORKSPACE = "some-workspace-id";

/** Routes that must never serve an anonymous caller. */
const guarded: Array<[string, string, Record<string, string>?]> = [
	["GET", "/api/settings"],
	["POST", "/api/settings"],
	["POST", "/api/backup/trigger"],
	["GET", "/api/backup/list"],
	["POST", "/api/backup/restore"],
	["GET", "/api/admin/users"],
	["GET", "/api/admin/workspaces"],
	["DELETE", "/api/admin/users/someone"],
	["POST", "/api/presence/heartbeat"],
	["POST", "/api/presence/leave"],
	["GET", `/api/presence/stream?workspaceId=${WORKSPACE}&pageId=p1`],
	[
		"GET",
		`/api/stream/view-config?databaseId=d1&viewId=v1&workspaceId=${WORKSPACE}`,
	],
	[
		"POST",
		"/api/upload",
		{
			"X-Page-Id": "p1",
			"X-File-Name": "pwn.txt",
			"X-Workspace-Id": WORKSPACE,
		},
	],
	["POST", "/import-notion", { "X-Workspace-Id": WORKSPACE }],
	// ADR-006: an attachment is readable only when its page is. Anonymous is
	// never that, so this must refuse before it ever looks at the disk.
	["GET", "/attachments/01HQ5X2Y3Z4A5B6C7D8E9F0G.png"],
];

describe("anonymous callers are refused", () => {
	for (const [method, path, headers] of guarded) {
		test(`${method} ${path}`, async () => {
			const res = await call(method, path, headers);
			expect([401, 403]).toContain(res.status);
		});
	}
});

describe("public routes stay reachable", () => {
	test("GET /health", async () => {
		expect((await call("GET", "/health")).status).toBe(200);
	});

	test("GET /api/public-config exposes only demoMode", async () => {
		const res = await call("GET", "/api/public-config");
		expect(res.status).toBe(200);
		expect(Object.keys(await res.json())).toEqual(["demoMode"]);
	});
});

describe("the specific holes that motivated this file", () => {
	test("GET /api/settings does not leak S3 credentials", async () => {
		const body = await (await call("GET", "/api/settings")).text();
		expect(body).not.toContain("s3SecretAccessKey");
		expect(body).not.toContain("s3AccessKeyId");
	});

	test("an anonymous write cannot repoint the backup bucket", async () => {
		await fetch(`${BASE}/api/settings`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ s3Bucket: "attacker-bucket", s3Enabled: true }),
			signal: AbortSignal.timeout(5000),
		});
		// Nothing was persisted, so the settings file was never created.
		expect(await Bun.file(join(DATA_DIR, "settings.json")).exists()).toBe(
			false,
		);
	});
});
