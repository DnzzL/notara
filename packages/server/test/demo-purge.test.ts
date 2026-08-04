import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Effect } from "effect";
import { ulid } from "ulidx";
import {
	deleteWorkspaceDb,
	WorkspaceDb,
	WorkspaceDbLive,
	workspaceDbFile,
} from "../src/db.js";
import { purgeExpiredDemos } from "../src/demo.js";
import { runPlatformMigrations } from "../src/platform-db.js";

function makeTestPlatformDb() {
	const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "notara-demo-test-"));
	const db = new Database(path.join(tmpDir, "platform.db"));
	runPlatformMigrations(db);
	return { db, tmpDir };
}

const hoursAgo = (h: number) =>
	new Date(Date.now() - h * 60 * 60 * 1000).toISOString();

describe("purgeExpiredDemos", () => {
	let db: Database;
	let tmpDir: string;
	let deleted: string[];
	const deleteDb = (id: string) => {
		deleted.push(id);
	};

	beforeEach(() => {
		const result = makeTestPlatformDb();
		db = result.db;
		tmpDir = result.tmpDir;
		deleted = [];
	});

	afterEach(() => {
		db.close();
		fs.rmSync(tmpDir, { recursive: true, force: true });
	});

	const insertUser = (id: string, isAnonymous: boolean) => {
		db.prepare(
			`INSERT INTO "user" (id, name, email, "emailVerified", "createdAt", "updatedAt", "isAnonymous")
       VALUES (?, ?, ?, 0, ?, ?, ?)`,
		).run(
			id,
			id,
			`${id}@example.com`,
			hoursAgo(0),
			hoursAgo(0),
			isAnonymous ? 1 : 0,
		);
	};

	const insertWorkspace = (opts: {
		id: string;
		ownerId: string;
		isDemo: boolean;
		createdAt: string;
	}) => {
		db.prepare(
			`INSERT INTO workspaces (id, name, slug, owner_id, invite_token, created_at, is_demo)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
		).run(
			opts.id,
			opts.id,
			opts.id,
			opts.ownerId,
			`token-${opts.id}`,
			opts.createdAt,
			opts.isDemo ? 1 : 0,
		);
		db.prepare(
			"INSERT INTO workspace_members (workspace_id, user_id, role, joined_at) VALUES (?, ?, 'owner', ?)",
		).run(opts.id, opts.ownerId, opts.createdAt);
	};

	const workspaceExists = (id: string) =>
		!!db.prepare("SELECT 1 FROM workspaces WHERE id = ?").get(id);
	const userExists = (id: string) =>
		!!db.prepare('SELECT 1 FROM "user" WHERE id = ?').get(id);

	// THE load-bearing assertion of this feature: real workspaces are never
	// touched by the demo purge, no matter how old they are.
	test("NEVER purges a non-demo workspace older than the TTL", () => {
		insertUser("real-user", false);
		insertWorkspace({
			id: "real-ws",
			ownerId: "real-user",
			isDemo: false,
			createdAt: hoursAgo(24 * 365),
		});

		const res = purgeExpiredDemos({ db, ttlHours: 1, deleteDb });

		expect(res.workspaces).toEqual([]);
		expect(deleted).toEqual([]);
		expect(workspaceExists("real-ws")).toBe(true);
		expect(userExists("real-user")).toBe(true);
		expect(
			db.prepare("SELECT COUNT(*) AS n FROM workspace_members").get(),
		).toEqual({ n: 1 });
	});

	test("purges an expired demo workspace: row, members and db file", () => {
		insertUser("anon-1", true);
		insertWorkspace({
			id: "demo-old",
			ownerId: "anon-1",
			isDemo: true,
			createdAt: hoursAgo(48),
		});

		const res = purgeExpiredDemos({ db, ttlHours: 24, deleteDb });

		expect(res.workspaces).toEqual(["demo-old"]);
		expect(deleted).toEqual(["demo-old"]);
		expect(workspaceExists("demo-old")).toBe(false);
		expect(
			db.prepare("SELECT COUNT(*) AS n FROM workspace_members").get(),
		).toEqual({ n: 0 });
	});

	test("keeps a demo workspace that is still within the TTL", () => {
		insertUser("anon-2", true);
		insertWorkspace({
			id: "demo-fresh",
			ownerId: "anon-2",
			isDemo: true,
			createdAt: hoursAgo(2),
		});

		const res = purgeExpiredDemos({ db, ttlHours: 24, deleteDb });

		expect(res.workspaces).toEqual([]);
		expect(deleted).toEqual([]);
		expect(workspaceExists("demo-fresh")).toBe(true);
		expect(userExists("anon-2")).toBe(true);
	});

	test("deletes the anonymous owner and its auth rows when it owns nothing else", () => {
		insertUser("anon-3", true);
		insertWorkspace({
			id: "demo-solo",
			ownerId: "anon-3",
			isDemo: true,
			createdAt: hoursAgo(48),
		});
		db.prepare(
			`INSERT INTO session (id, "expiresAt", token, "createdAt", "updatedAt", "userId")
       VALUES ('s1', ?, 'tok1', ?, ?, 'anon-3')`,
		).run(hoursAgo(0), hoursAgo(0), hoursAgo(0));
		db.prepare(
			`INSERT INTO account (id, "accountId", "providerId", "userId", "createdAt", "updatedAt")
       VALUES ('a1', 'anon-3', 'credential', 'anon-3', ?, ?)`,
		).run(hoursAgo(0), hoursAgo(0));

		const res = purgeExpiredDemos({ db, ttlHours: 24, deleteDb });

		expect(res.users).toEqual(["anon-3"]);
		expect(userExists("anon-3")).toBe(false);
		// FK pragma is OFF in this codebase, so children must be removed explicitly.
		expect(db.prepare("SELECT COUNT(*) AS n FROM session").get()).toEqual({
			n: 0,
		});
		expect(db.prepare("SELECT COUNT(*) AS n FROM account").get()).toEqual({
			n: 0,
		});
	});

	test("keeps the anonymous owner when it still owns another workspace", () => {
		insertUser("anon-4", true);
		insertWorkspace({
			id: "demo-expired",
			ownerId: "anon-4",
			isDemo: true,
			createdAt: hoursAgo(48),
		});
		insertWorkspace({
			id: "demo-kept",
			ownerId: "anon-4",
			isDemo: true,
			createdAt: hoursAgo(1),
		});

		const res = purgeExpiredDemos({ db, ttlHours: 24, deleteDb });

		expect(res.workspaces).toEqual(["demo-expired"]);
		expect(res.users).toEqual([]);
		expect(userExists("anon-4")).toBe(true);
		expect(workspaceExists("demo-kept")).toBe(true);
	});

	test("never deletes a non-anonymous owner of an expired demo workspace", () => {
		insertUser("real-owner", false);
		insertWorkspace({
			id: "demo-owned-by-real-user",
			ownerId: "real-owner",
			isDemo: true,
			createdAt: hoursAgo(48),
		});

		const res = purgeExpiredDemos({ db, ttlHours: 24, deleteDb });

		expect(res.workspaces).toEqual(["demo-owned-by-real-user"]);
		expect(res.users).toEqual([]);
		expect(userExists("real-owner")).toBe(true);
	});
});

describe("deleteWorkspaceDb", () => {
	// getLayer creates the file, runs the workspace migrations and caches the layer.
	const openWorkspace = (workspaceId: string) =>
		Effect.gen(function* () {
			const wdb = yield* WorkspaceDb;
			wdb.getLayer(workspaceId);
		}).pipe(Effect.provide(WorkspaceDbLive), Effect.runPromise);

	test("removes the workspace db file and is idempotent", async () => {
		const workspaceId = `test-${ulid()}`;
		const dbPath = workspaceDbFile(workspaceId);

		await openWorkspace(workspaceId);
		expect(fs.existsSync(dbPath)).toBe(true);

		deleteWorkspaceDb(workspaceId);
		expect(fs.existsSync(dbPath)).toBe(false);
		expect(fs.existsSync(`${dbPath}-wal`)).toBe(false);
		expect(fs.existsSync(`${dbPath}-shm`)).toBe(false);

		// Idempotent: a second call on an already-gone workspace must not throw.
		expect(() => deleteWorkspaceDb(workspaceId)).not.toThrow();
	});

	test("evicts the layer cache so a later open recreates the file", async () => {
		const workspaceId = `test-${ulid()}`;
		const dbPath = workspaceDbFile(workspaceId);

		await openWorkspace(workspaceId);
		deleteWorkspaceDb(workspaceId);
		expect(fs.existsSync(dbPath)).toBe(false);

		// A cached layer would still point at the deleted file, so nothing would
		// be recreated here.
		await openWorkspace(workspaceId);
		expect(fs.existsSync(dbPath)).toBe(true);

		deleteWorkspaceDb(workspaceId);
	});
});
