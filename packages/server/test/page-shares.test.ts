/**
 * The share capability, exercised without a server.
 *
 * Everything here is platform-DB only: minting, resolving and revoking a token
 * is deliberately separate from deciding whether the page behind it may still
 * be read. That second question needs the workspace DB and the ACL, and it is
 * asked by the serving route (e2e), not by this module — which is why this
 * module is testable at all.
 */
import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Effect, Layer } from "effect";
import * as PageShares from "../src/handlers/page-shares.js";
import { PlatformDb, runPlatformMigrations } from "../src/platform-db.js";

let db: Database;
let tmpDir: string;

const run = <A, E>(effect: Effect.Effect<A, E, PlatformDb>) =>
	effect.pipe(Effect.provide(Layer.succeed(PlatformDb, db)), Effect.runPromise);

beforeEach(() => {
	tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "notara-share-test-"));
	db = new Database(path.join(tmpDir, "platform.db"));
	runPlatformMigrations(db);
});

afterEach(() => {
	db.close();
	fs.rmSync(tmpDir, { recursive: true, force: true });
});

const ws = "ws-1";
const page = "page-1";

describe("enable", () => {
	test("returns a token that resolves back to the page it was minted for", async () => {
		const token = await run(PageShares.enable(ws, page, "user-1"));
		expect(await run(PageShares.resolveToken(token))).toEqual({
			workspaceId: ws,
			pageId: page,
			sharedBy: "user-1",
		});
	});

	test("is idempotent — a page has at most one live token", async () => {
		// Two links to the same page would make revoking ambiguous: disabling
		// would silently leave the other one working.
		const first = await run(PageShares.enable(ws, page, "user-1"));
		const second = await run(PageShares.enable(ws, page, "user-2"));
		expect(second).toBe(first);

		// The original publisher is kept, so re-enabling cannot be used to
		// re-point an existing link at someone else's access.
		expect(await run(PageShares.resolveToken(first))).toMatchObject({
			sharedBy: "user-1",
		});
	});

	test("tokens are not guessable from one another", async () => {
		// The invite token is a ULID, which is time-ordered and largely
		// predictable from a neighbour. A token published to the open web cannot
		// be: it is the entire credential.
		const a = await run(PageShares.enable(ws, "page-a", "user-1"));
		const b = await run(PageShares.enable(ws, "page-b", "user-1"));
		expect(a).not.toBe(b);
		expect(a.length).toBeGreaterThanOrEqual(32);
		// A ULID's first 10 characters encode the millisecond it was minted, so
		// two minted in the same test would share them. These must not.
		expect(a.slice(0, 10)).not.toBe(b.slice(0, 10));
	});
});

describe("get", () => {
	test("returns the token when the page is shared", async () => {
		const token = await run(PageShares.enable(ws, page, "user-1"));
		expect(await run(PageShares.get(ws, page))).toBe(token);
	});

	test("returns null when it is not", async () => {
		expect(await run(PageShares.get(ws, page))).toBeNull();
	});
});

describe("disable", () => {
	test("makes the token stop resolving", async () => {
		const token = await run(PageShares.enable(ws, page, "user-1"));
		await run(PageShares.disable(ws, page));
		expect(await run(PageShares.resolveToken(token))).toBeNull();
		expect(await run(PageShares.get(ws, page))).toBeNull();
	});

	test("on an unshared page is not an error", async () => {
		// The UI toggles this; a double-off must not be a failure to report.
		await run(PageShares.disable(ws, page));
		expect(await run(PageShares.get(ws, page))).toBeNull();
	});

	test("re-enabling after disabling mints a fresh token", async () => {
		// Revocation has to be final. If disable/enable returned the old token,
		// a link handed out and taken back would come alive again.
		const first = await run(PageShares.enable(ws, page, "user-1"));
		await run(PageShares.disable(ws, page));
		const second = await run(PageShares.enable(ws, page, "user-1"));
		expect(second).not.toBe(first);
		expect(await run(PageShares.resolveToken(first))).toBeNull();
	});
});

describe("resolveToken", () => {
	test("returns null for a token that was never minted", async () => {
		expect(await run(PageShares.resolveToken("not-a-token"))).toBeNull();
	});

	test("keeps two workspaces' shares apart", async () => {
		const a = await run(PageShares.enable("ws-a", page, "user-1"));
		const b = await run(PageShares.enable("ws-b", page, "user-2"));
		expect(await run(PageShares.resolveToken(a))).toMatchObject({
			workspaceId: "ws-a",
		});
		expect(await run(PageShares.resolveToken(b))).toMatchObject({
			workspaceId: "ws-b",
		});
	});
});
