import { Database } from "bun:sqlite";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { SqliteClient } from "@effect/sql-sqlite-bun";
import { Effect, Layer } from "effect";
import * as Pages from "../src/handlers/pages.js";
import * as Permissions from "../src/handlers/permissions.js";
import { PlatformDb, runPlatformMigrations } from "../src/platform-db.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeTestDbs() {
	const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "notara-perm-test-"));
	const platformDb = new Database(path.join(tmpDir, "platform.db"));
	runPlatformMigrations(platformDb);

	const sqliteFilename = path.join(tmpDir, "data.db");
	const sqliteDb = new Database(sqliteFilename);

	const migrationsDir = path.join(
		import.meta.dirname || __dirname,
		"../migrations",
	);
	const files = fs
		.readdirSync(migrationsDir)
		.filter((f) => f.endsWith(".sql"))
		.sort();
	for (const file of files) {
		const sql = fs.readFileSync(path.join(migrationsDir, file), "utf-8");
		sqliteDb.exec(sql);
	}
	sqliteDb.close();

	return { tmpDir, platformDb, sqliteFilename };
}

function cleanup(tmpDir: string) {
	fs.rmSync(tmpDir, { recursive: true, force: true });
}

function seedWorkspace(
	platformDb: Database,
	userId: string,
	userName: string,
	role: "owner" | "member",
) {
	const now = new Date().toISOString();
	platformDb
		.prepare(
			'INSERT OR IGNORE INTO "user" (id, name, email, "createdAt", "updatedAt") VALUES (?, ?, ?, ?, ?)',
		)
		.run(userId, userName, `${userId}@test.com`, now, now);
	const wsId = `ws-${userId}-${Date.now()}`;
	const inviteToken = `inv-${userId}-${Date.now()}`;
	platformDb
		.prepare(
			"INSERT INTO workspaces (id, name, slug, owner_id, invite_token, created_at) VALUES (?, ?, ?, ?, ?, ?)",
		)
		.run(
			wsId,
			`${userName}'s workspace`,
			`${userId}-ws`,
			userId,
			inviteToken,
			now,
		);
	platformDb
		.prepare(
			"INSERT INTO workspace_members (workspace_id, user_id, role, joined_at) VALUES (?, ?, ?, ?)",
		)
		.run(wsId, userId, role, now);
	return { workspaceId: wsId, userId };
}

function makeLayers(platformDb: Database, sqliteFilename: string) {
	return Layer.provideMerge(
		Layer.succeed(PlatformDb, platformDb),
		SqliteClient.layer({ filename: sqliteFilename }),
	);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Permissions", () => {
	let platformDb: Database;
	let sqliteFilename: string;
	let tmpDir: string;
	let owner: ReturnType<typeof seedWorkspace>;
	let member: ReturnType<typeof seedWorkspace>;

	beforeAll(() => {
		const dbs = makeTestDbs();
		platformDb = dbs.platformDb;
		sqliteFilename = dbs.sqliteFilename;
		tmpDir = dbs.tmpDir;

		owner = seedWorkspace(platformDb, "owner-user", "Owner", "owner");
		member = seedWorkspace(platformDb, "member-user", "Member", "member");
	});

	afterAll(() => {
		platformDb.close();
		cleanup(tmpDir);
	});

	// ── Workspace owner always passes ─────────────────────────────────────────

	test("workspace owner resolves to owner relation with no ACL", async () => {
		const page = await Pages.createPage({
			title: "Owner Page",
			parentId: null,
		}).pipe(
			Effect.provide(SqliteClient.layer({ filename: sqliteFilename })),
			Effect.runPromise,
		);

		const rel = await Permissions.resolveEffectiveRelation(
			owner.userId,
			owner.workspaceId,
			page.id,
		).pipe(
			Effect.provide(makeLayers(platformDb, sqliteFilename)),
			Effect.runPromise,
		);

		expect(rel).toBe("owner");
	});

	test("workspace owner can access page with viewer permission requirement", async () => {
		const page = await Pages.createPage({
			title: "Owner Access",
			parentId: null,
		}).pipe(
			Effect.provide(SqliteClient.layer({ filename: sqliteFilename })),
			Effect.runPromise,
		);

		const result = await Permissions.checkPagePermission(
			owner.userId,
			owner.workspaceId,
			page.id,
			"viewer",
		).pipe(
			Effect.provide(makeLayers(platformDb, sqliteFilename)),
			Effect.runPromise,
		);

		expect(result).toBeUndefined();
	});

	// ── Workspace member with no ACL = editor ────────────────────────────────

	test("workspace member resolves to editor relation with no ACL", async () => {
		const page = await Pages.createPage({
			title: "Member Page",
			parentId: null,
		}).pipe(
			Effect.provide(SqliteClient.layer({ filename: sqliteFilename })),
			Effect.runPromise,
		);

		const rel = await Permissions.resolveEffectiveRelation(
			member.userId,
			member.workspaceId,
			page.id,
		).pipe(
			Effect.provide(makeLayers(platformDb, sqliteFilename)),
			Effect.runPromise,
		);

		expect(rel).toBe("editor");
	});

	test("workspace member can access page with editor permission requirement", async () => {
		const page = await Pages.createPage({
			title: "Member Editor",
			parentId: null,
		}).pipe(
			Effect.provide(SqliteClient.layer({ filename: sqliteFilename })),
			Effect.runPromise,
		);

		const result = await Permissions.checkPagePermission(
			member.userId,
			member.workspaceId,
			page.id,
			"editor",
		).pipe(
			Effect.provide(makeLayers(platformDb, sqliteFilename)),
			Effect.runPromise,
		);

		expect(result).toBeUndefined();
	});

	test("non-member user resolves to null", async () => {
		const page = await Pages.createPage({
			title: "Stranger Page",
			parentId: null,
		}).pipe(
			Effect.provide(SqliteClient.layer({ filename: sqliteFilename })),
			Effect.runPromise,
		);

		const rel = await Permissions.resolveEffectiveRelation(
			"non-member",
			owner.workspaceId,
			page.id,
		).pipe(
			Effect.provide(makeLayers(platformDb, sqliteFilename)),
			Effect.runPromise,
		);

		expect(rel).toBeNull();
	});

	// ── Explicit viewer/editor/owner grants ──────────────────────────────────
	//
	// NOTE: writePagePermissions enforces a guard: if any ACL entries exist on
	// the page after a write, at least one must have relation="owner". Tests that
	// set viewer/editor grants must therefore also include an owner grant.

	test("explicit viewer grant overrides default editor", async () => {
		const page = await Pages.createPage({
			title: "Viewer Page",
			parentId: null,
		}).pipe(
			Effect.provide(SqliteClient.layer({ filename: sqliteFilename })),
			Effect.runPromise,
		);

		// Grant viewer to member + owner to workspace owner (required by guard)
		await Permissions.writePagePermissions({
			pageId: page.id,
			set: [
				{ subject: { type: "user", id: member.userId }, relation: "viewer" },
				{ subject: { type: "user", id: owner.userId }, relation: "owner" },
			],
			remove: [],
		}).pipe(
			Effect.provide(makeLayers(platformDb, sqliteFilename)),
			Effect.runPromise,
		);

		const rel = await Permissions.resolveEffectiveRelation(
			member.userId,
			member.workspaceId,
			page.id,
		).pipe(
			Effect.provide(makeLayers(platformDb, sqliteFilename)),
			Effect.runPromise,
		);

		expect(rel).toBe("viewer");
	});

	test("explicit editor grant on member", async () => {
		const page = await Pages.createPage({
			title: "Editor Grant",
			parentId: null,
		}).pipe(
			Effect.provide(SqliteClient.layer({ filename: sqliteFilename })),
			Effect.runPromise,
		);

		await Permissions.writePagePermissions({
			pageId: page.id,
			set: [
				{ subject: { type: "user", id: member.userId }, relation: "editor" },
				{ subject: { type: "user", id: owner.userId }, relation: "owner" },
			],
			remove: [],
		}).pipe(
			Effect.provide(makeLayers(platformDb, sqliteFilename)),
			Effect.runPromise,
		);

		const rel = await Permissions.resolveEffectiveRelation(
			member.userId,
			member.workspaceId,
			page.id,
		).pipe(
			Effect.provide(makeLayers(platformDb, sqliteFilename)),
			Effect.runPromise,
		);

		expect(rel).toBe("editor");
	});

	test("explicit owner grant on member", async () => {
		const page = await Pages.createPage({
			title: "Owner Grant",
			parentId: null,
		}).pipe(
			Effect.provide(SqliteClient.layer({ filename: sqliteFilename })),
			Effect.runPromise,
		);

		await Permissions.writePagePermissions({
			pageId: page.id,
			set: [
				{ subject: { type: "user", id: member.userId }, relation: "owner" },
			],
			remove: [],
		}).pipe(
			Effect.provide(makeLayers(platformDb, sqliteFilename)),
			Effect.runPromise,
		);

		const rel = await Permissions.resolveEffectiveRelation(
			member.userId,
			member.workspaceId,
			page.id,
		).pipe(
			Effect.provide(makeLayers(platformDb, sqliteFilename)),
			Effect.runPromise,
		);

		expect(rel).toBe("owner");
	});

	test("higher-rank relation overrides lower-rank when both set", async () => {
		const page = await Pages.createPage({
			title: "Rank Override",
			parentId: null,
		}).pipe(
			Effect.provide(SqliteClient.layer({ filename: sqliteFilename })),
			Effect.runPromise,
		);

		// Write both viewer + owner first, then upgrade member to editor
		await Permissions.writePagePermissions({
			pageId: page.id,
			set: [
				{ subject: { type: "user", id: member.userId }, relation: "viewer" },
				{ subject: { type: "user", id: owner.userId }, relation: "owner" },
			],
			remove: [],
		}).pipe(
			Effect.provide(makeLayers(platformDb, sqliteFilename)),
			Effect.runPromise,
		);

		await Permissions.writePagePermissions({
			pageId: page.id,
			set: [
				{ subject: { type: "user", id: member.userId }, relation: "editor" },
			],
			remove: [],
		}).pipe(
			Effect.provide(makeLayers(platformDb, sqliteFilename)),
			Effect.runPromise,
		);

		const rel = await Permissions.resolveEffectiveRelation(
			member.userId,
			member.workspaceId,
			page.id,
		).pipe(
			Effect.provide(makeLayers(platformDb, sqliteFilename)),
			Effect.runPromise,
		);

		expect(rel).toBe("editor");
	});

	// ── Subject matching (user:, workspace:#member, public) ───────────────────

	test("workspace:member subject grants all workspace members", async () => {
		const page = await Pages.createPage({
			title: "All Members",
			parentId: null,
		}).pipe(
			Effect.provide(SqliteClient.layer({ filename: sqliteFilename })),
			Effect.runPromise,
		);

		await Permissions.writePagePermissions({
			pageId: page.id,
			set: [
				{
					subject: {
						type: "workspace",
						id: member.workspaceId,
						relation: "member",
					},
					relation: "viewer",
				},
				{ subject: { type: "user", id: owner.userId }, relation: "owner" },
			],
			remove: [],
		}).pipe(
			Effect.provide(makeLayers(platformDb, sqliteFilename)),
			Effect.runPromise,
		);

		const rel = await Permissions.resolveEffectiveRelation(
			member.userId,
			member.workspaceId,
			page.id,
		).pipe(
			Effect.provide(makeLayers(platformDb, sqliteFilename)),
			Effect.runPromise,
		);

		expect(rel).toBe("viewer");
	});

	test("public subject grants access to any workspace member", async () => {
		const page = await Pages.createPage({
			title: "Public Page",
			parentId: null,
		}).pipe(
			Effect.provide(SqliteClient.layer({ filename: sqliteFilename })),
			Effect.runPromise,
		);

		await Permissions.writePagePermissions({
			pageId: page.id,
			set: [
				{ subject: { type: "public" }, relation: "viewer" },
				{ subject: { type: "user", id: owner.userId }, relation: "owner" },
			],
			remove: [],
		}).pipe(
			Effect.provide(makeLayers(platformDb, sqliteFilename)),
			Effect.runPromise,
		);

		const rel = await Permissions.resolveEffectiveRelation(
			member.userId,
			member.workspaceId,
			page.id,
		).pipe(
			Effect.provide(makeLayers(platformDb, sqliteFilename)),
			Effect.runPromise,
		);

		expect(rel).toBe("viewer");
	});

	// ── Ancestor ACL inheritance ──────────────────────────────────────────────

	test("child page inherits ACL from parent (locked ancestor)", async () => {
		const parent = await Pages.createPage({
			title: "Parent",
			parentId: null,
		}).pipe(
			Effect.provide(SqliteClient.layer({ filename: sqliteFilename })),
			Effect.runPromise,
		);
		const child = await Pages.createPage({
			title: "Child",
			parentId: parent.id,
		}).pipe(
			Effect.provide(SqliteClient.layer({ filename: sqliteFilename })),
			Effect.runPromise,
		);

		// Lock the parent with grants for both member and owner
		await Permissions.writePagePermissions({
			pageId: parent.id,
			set: [
				{ subject: { type: "user", id: member.userId }, relation: "viewer" },
				{ subject: { type: "user", id: owner.userId }, relation: "owner" },
			],
			remove: [],
		}).pipe(
			Effect.provide(makeLayers(platformDb, sqliteFilename)),
			Effect.runPromise,
		);

		// Child should inherit viewer from parent lock
		const rel = await Permissions.resolveEffectiveRelation(
			member.userId,
			member.workspaceId,
			child.id,
		).pipe(
			Effect.provide(makeLayers(platformDb, sqliteFilename)),
			Effect.runPromise,
		);

		expect(rel).toBe("viewer");
	});

	test("child inherits highest relation from ancestor lock", async () => {
		const parent = await Pages.createPage({
			title: "Ancestor",
			parentId: null,
		}).pipe(
			Effect.provide(SqliteClient.layer({ filename: sqliteFilename })),
			Effect.runPromise,
		);
		const child = await Pages.createPage({
			title: "Descendant",
			parentId: parent.id,
		}).pipe(
			Effect.provide(SqliteClient.layer({ filename: sqliteFilename })),
			Effect.runPromise,
		);
		const grandchild = await Pages.createPage({
			title: "Grandchild",
			parentId: child.id,
		}).pipe(
			Effect.provide(SqliteClient.layer({ filename: sqliteFilename })),
			Effect.runPromise,
		);

		// Grant owner on the parent (already an owner grant from the member test user)
		await Permissions.writePagePermissions({
			pageId: parent.id,
			set: [
				{ subject: { type: "user", id: member.userId }, relation: "owner" },
			],
			remove: [],
		}).pipe(
			Effect.provide(makeLayers(platformDb, sqliteFilename)),
			Effect.runPromise,
		);

		// Grandchild should inherit owner from ancestor
		const rel = await Permissions.resolveEffectiveRelation(
			member.userId,
			member.workspaceId,
			grandchild.id,
		).pipe(
			Effect.provide(makeLayers(platformDb, sqliteFilename)),
			Effect.runPromise,
		);

		expect(rel).toBe("owner");
	});

	// ── Blocked-by-ancestor ───────────────────────────────────────────────────

	test("child blocked when ancestor locked and user has no grant", async () => {
		const parent = await Pages.createPage({
			title: "Locked Parent",
			parentId: null,
		}).pipe(
			Effect.provide(SqliteClient.layer({ filename: sqliteFilename })),
			Effect.runPromise,
		);
		const child = await Pages.createPage({
			title: "Blocked Child",
			parentId: parent.id,
		}).pipe(
			Effect.provide(SqliteClient.layer({ filename: sqliteFilename })),
			Effect.runPromise,
		);

		// Lock the parent with a grant only for owner and a different user
		await Permissions.writePagePermissions({
			pageId: parent.id,
			set: [
				{ subject: { type: "user", id: "other-user" }, relation: "editor" },
				{ subject: { type: "user", id: owner.userId }, relation: "owner" },
			],
			remove: [],
		}).pipe(
			Effect.provide(makeLayers(platformDb, sqliteFilename)),
			Effect.runPromise,
		);

		// Member has no grant on the locked parent, so child should be inaccessible
		const rel = await Permissions.resolveEffectiveRelation(
			member.userId,
			member.workspaceId,
			child.id,
		).pipe(
			Effect.provide(makeLayers(platformDb, sqliteFilename)),
			Effect.runPromise,
		);

		expect(rel).toBeNull();
	});

	// ── Write + readback roundtrip ─────────────────────────────────────────────

	test("write then read ACL roundtrip", async () => {
		const page = await Pages.createPage({
			title: "Roundtrip",
			parentId: null,
		}).pipe(
			Effect.provide(SqliteClient.layer({ filename: sqliteFilename })),
			Effect.runPromise,
		);

		const writeResult = await Permissions.writePagePermissions({
			pageId: page.id,
			set: [
				{ subject: { type: "user", id: owner.userId }, relation: "owner" },
				{ subject: { type: "user", id: member.userId }, relation: "editor" },
				{
					subject: {
						type: "workspace",
						id: member.workspaceId,
						relation: "member",
					},
					relation: "viewer",
				},
			],
			remove: [],
		}).pipe(
			Effect.provide(makeLayers(platformDb, sqliteFilename)),
			Effect.runPromise,
		);

		expect(writeResult.revision).toBeDefined();
		expect(Number(writeResult.revision)).toBeGreaterThan(0);

		// Read back
		const permissions = await Permissions.getPagePermissions(page.id).pipe(
			Effect.provide(makeLayers(platformDb, sqliteFilename)),
			Effect.runPromise,
		);

		expect(permissions.direct.length).toBe(3);
		expect(permissions.revision).toBe(writeResult.revision);
	});

	// ── Revision bumps ────────────────────────────────────────────────────────

	test("revision bumps on each write", async () => {
		const page = await Pages.createPage({
			title: "Revisions",
			parentId: null,
		}).pipe(
			Effect.provide(SqliteClient.layer({ filename: sqliteFilename })),
			Effect.runPromise,
		);

		const r1 = await Permissions.writePagePermissions({
			pageId: page.id,
			set: [
				{ subject: { type: "user", id: member.userId }, relation: "viewer" },
				{ subject: { type: "user", id: owner.userId }, relation: "owner" },
			],
			remove: [],
		}).pipe(
			Effect.provide(makeLayers(platformDb, sqliteFilename)),
			Effect.runPromise,
		);

		const r2 = await Permissions.writePagePermissions({
			pageId: page.id,
			set: [
				{ subject: { type: "user", id: member.userId }, relation: "editor" },
			],
			remove: [],
		}).pipe(
			Effect.provide(makeLayers(platformDb, sqliteFilename)),
			Effect.runPromise,
		);

		expect(Number(r2.revision)).toBe(Number(r1.revision) + 1);
	});

	test("write with stale ifRevision returns 409", async () => {
		const page = await Pages.createPage({
			title: "Conflict",
			parentId: null,
		}).pipe(
			Effect.provide(SqliteClient.layer({ filename: sqliteFilename })),
			Effect.runPromise,
		);

		// First write to get a revision
		const r1 = await Permissions.writePagePermissions({
			pageId: page.id,
			set: [{ subject: { type: "user", id: owner.userId }, relation: "owner" }],
			remove: [],
		}).pipe(
			Effect.provide(makeLayers(platformDb, sqliteFilename)),
			Effect.runPromise,
		);

		// Second write (bumps revision) — remove the owner (page becomes open, no ACL entries)
		await Permissions.writePagePermissions({
			pageId: page.id,
			set: [],
			remove: [{ subject: { type: "user", id: owner.userId } }],
		}).pipe(
			Effect.provide(makeLayers(platformDb, sqliteFilename)),
			Effect.runPromise,
		);

		// Third write with stale ifRevision
		const result = await Permissions.writePagePermissions({
			pageId: page.id,
			ifRevision: r1.revision,
			set: [{ subject: { type: "user", id: owner.userId }, relation: "owner" }],
			remove: [],
		}).pipe(
			Effect.provide(makeLayers(platformDb, sqliteFilename)),
			Effect.runPromiseExit,
		);

		expect(result._tag).toBe("Failure");
	});

	// ── filterPagesByPermission ───────────────────────────────────────────────

	test("member sees pages with inherited or direct ACL access", async () => {
		const ownerPage = await Pages.createPage({
			title: "Open",
			parentId: null,
		}).pipe(
			Effect.provide(SqliteClient.layer({ filename: sqliteFilename })),
			Effect.runPromise,
		);
		const restricted = await Pages.createPage({
			title: "Restricted",
			parentId: null,
		}).pipe(
			Effect.provide(SqliteClient.layer({ filename: sqliteFilename })),
			Effect.runPromise,
		);
		const childOfRestricted = await Pages.createPage({
			title: "Child",
			parentId: restricted.id,
		}).pipe(
			Effect.provide(SqliteClient.layer({ filename: sqliteFilename })),
			Effect.runPromise,
		);

		// Lock restricted with a grant for both member and owner
		await Permissions.writePagePermissions({
			pageId: restricted.id,
			set: [
				{ subject: { type: "user", id: member.userId }, relation: "viewer" },
				{ subject: { type: "user", id: owner.userId }, relation: "owner" },
			],
			remove: [],
		}).pipe(
			Effect.provide(makeLayers(platformDb, sqliteFilename)),
			Effect.runPromise,
		);

		const allPages = await Pages.listPages.pipe(
			Effect.provide(SqliteClient.layer({ filename: sqliteFilename })),
			Effect.runPromise,
		);

		const visible = await Permissions.filterPagesByPermission(
			member.userId,
			member.workspaceId,
			"member",
			allPages,
		).pipe(
			Effect.provide(makeLayers(platformDb, sqliteFilename)),
			Effect.runPromise,
		);

		// Member should see open page + restricted (has grant) + child (inherits via restricted)
		const visibleIds = visible.map((p) => p.id);
		expect(visibleIds).toContain(ownerPage.id);
		expect(visibleIds).toContain(restricted.id);
		expect(visibleIds).toContain(childOfRestricted.id);
	});
});
