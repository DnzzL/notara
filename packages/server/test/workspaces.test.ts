import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Effect, Layer } from "effect";
import * as Workspaces from "../src/handlers/workspaces.js";
import { PlatformDb, runPlatformMigrations } from "../src/platform-db.js";

function makeTestPlatformDb() {
	const tmpDir = fs.mkdtempSync(
		path.join(os.tmpdir(), "notara-platform-test-"),
	);
	const filename = path.join(tmpDir, "platform.db");
	const db = new Database(filename);
	runPlatformMigrations(db);
	return { db, tmpDir };
}

function cleanup(tmpDir: string) {
	fs.rmSync(tmpDir, { recursive: true, force: true });
}

const makeLayer = (db: Database) => Layer.succeed(PlatformDb, db);

describe("Workspaces", () => {
	let db: Database;
	let tmpDir: string;

	beforeEach(() => {
		const result = makeTestPlatformDb();
		db = result.db;
		tmpDir = result.tmpDir;
	});

	afterEach(() => {
		db.close();
		cleanup(tmpDir);
	});

	test("createWorkspace creates a workspace with owner membership", async () => {
		const workspace = await Workspaces.createWorkspace({
			userId: "user-1",
			name: "My Workspace",
			slug: "my-workspace",
		}).pipe(Effect.provide(makeLayer(db)), Effect.runPromise);

		expect(workspace.id).toBeDefined();
		expect(workspace.name).toBe("My Workspace");
		expect(workspace.slug).toBe("my-workspace");
		expect(workspace.role).toBe("owner");
		expect(workspace.inviteToken).toBeDefined();
	});

	test("createWorkspace fails if slug is already taken", async () => {
		await Workspaces.createWorkspace({
			userId: "user-1",
			name: "First",
			slug: "same-slug",
		}).pipe(Effect.provide(makeLayer(db)), Effect.runPromise);

		const result = await Workspaces.createWorkspace({
			userId: "user-2",
			name: "Second",
			slug: "same-slug",
		}).pipe(Effect.provide(makeLayer(db)), Effect.runPromiseExit);

		expect(result._tag).toBe("Failure");
	});

	test("getMyWorkspaces returns all workspaces for a user", async () => {
		await Workspaces.createWorkspace({
			userId: "user-1",
			name: "WS A",
			slug: "ws-a",
		}).pipe(Effect.provide(makeLayer(db)), Effect.runPromise);
		await Workspaces.createWorkspace({
			userId: "user-1",
			name: "WS B",
			slug: "ws-b",
		}).pipe(Effect.provide(makeLayer(db)), Effect.runPromise);

		const workspaces = await Workspaces.getMyWorkspaces("user-1").pipe(
			Effect.provide(makeLayer(db)),
			Effect.runPromise,
		);

		expect(workspaces.length).toBe(2);
		const slugs = workspaces.map((w) => w.slug);
		expect(slugs).toContain("ws-a");
		expect(slugs).toContain("ws-b");
	});

	test("getMyWorkspaces only shows owner invite token", async () => {
		const ws = await Workspaces.createWorkspace({
			userId: "owner-1",
			name: "Shared",
			slug: "shared",
		}).pipe(Effect.provide(makeLayer(db)), Effect.runPromise);

		// Join as member
		await Workspaces.joinWorkspaceByToken({
			userId: "member-1",
			inviteToken: ws.inviteToken!,
		}).pipe(Effect.provide(makeLayer(db)), Effect.runPromise);

		const ownerWorkspaces = await Workspaces.getMyWorkspaces("owner-1").pipe(
			Effect.provide(makeLayer(db)),
			Effect.runPromise,
		);
		const memberWorkspaces = await Workspaces.getMyWorkspaces("member-1").pipe(
			Effect.provide(makeLayer(db)),
			Effect.runPromise,
		);

		expect(ownerWorkspaces[0].inviteToken).toBeTruthy();
		expect(memberWorkspaces[0].inviteToken).toBeNull();
	});

	test("joinWorkspaceByToken adds member to workspace", async () => {
		const ws = await Workspaces.createWorkspace({
			userId: "owner-1",
			name: "Collab",
			slug: "collab",
		}).pipe(Effect.provide(makeLayer(db)), Effect.runPromise);

		const joined = await Workspaces.joinWorkspaceByToken({
			userId: "new-user",
			inviteToken: ws.inviteToken!,
		}).pipe(Effect.provide(makeLayer(db)), Effect.runPromise);

		expect(joined.slug).toBe("collab");
		expect(joined.role).toBe("member");
	});

	test("joinWorkspaceByToken fails with invalid token", async () => {
		const result = await Workspaces.joinWorkspaceByToken({
			userId: "user-1",
			inviteToken: "invalid-token",
		}).pipe(Effect.provide(makeLayer(db)), Effect.runPromiseExit);

		expect(result._tag).toBe("Failure");
	});

	test("getWorkspaceMembers returns all members", async () => {
		const now = new Date().toISOString();
		db.prepare(
			'INSERT INTO "user" (id, name, email, "createdAt", "updatedAt") VALUES (?, ?, ?, ?, ?)',
		).run("owner-1", "Owner", "owner@test.com", now, now);
		db.prepare(
			'INSERT INTO "user" (id, name, email, "createdAt", "updatedAt") VALUES (?, ?, ?, ?, ?)',
		).run("member-1", "Member", "member@test.com", now, now);

		const ws = await Workspaces.createWorkspace({
			userId: "owner-1",
			name: "Team",
			slug: "team",
		}).pipe(Effect.provide(makeLayer(db)), Effect.runPromise);

		await Workspaces.joinWorkspaceByToken({
			userId: "member-1",
			inviteToken: ws.inviteToken!,
		}).pipe(Effect.provide(makeLayer(db)), Effect.runPromise);

		const members = await Workspaces.getWorkspaceMembers(ws.id).pipe(
			Effect.provide(makeLayer(db)),
			Effect.runPromise,
		);

		expect(members.length).toBe(2);
		const roles = members.map((m) => m.role);
		expect(roles).toContain("owner");
		expect(roles).toContain("member");
	});

	test("removeMember removes a member (owner cannot be removed)", async () => {
		const now = new Date().toISOString();
		db.prepare(
			'INSERT INTO "user" (id, name, email, "createdAt", "updatedAt") VALUES (?, ?, ?, ?, ?)',
		).run("owner-1", "Owner", "owner@test.com", now, now);
		db.prepare(
			'INSERT INTO "user" (id, name, email, "createdAt", "updatedAt") VALUES (?, ?, ?, ?, ?)',
		).run("member-1", "Member", "member@test.com", now, now);

		const ws = await Workspaces.createWorkspace({
			userId: "owner-1",
			name: "Team",
			slug: "team-rm",
		}).pipe(Effect.provide(makeLayer(db)), Effect.runPromise);

		await Workspaces.joinWorkspaceByToken({
			userId: "member-1",
			inviteToken: ws.inviteToken!,
		}).pipe(Effect.provide(makeLayer(db)), Effect.runPromise);

		await Workspaces.removeMember({
			workspaceId: ws.id,
			userId: "member-1",
		}).pipe(Effect.provide(makeLayer(db)), Effect.runPromise);

		const members = await Workspaces.getWorkspaceMembers(ws.id).pipe(
			Effect.provide(makeLayer(db)),
			Effect.runPromise,
		);

		expect(members.length).toBe(1);
		expect(members[0].role).toBe("owner");
	});

	test("regenerateInviteLink returns new token and old token is invalidated", async () => {
		const ws = await Workspaces.createWorkspace({
			userId: "owner-1",
			name: "Regen",
			slug: "regen",
		}).pipe(Effect.provide(makeLayer(db)), Effect.runPromise);

		const oldToken = ws.inviteToken!;

		const { inviteToken: newToken } = await Workspaces.regenerateInviteLink(
			ws.id,
		).pipe(Effect.provide(makeLayer(db)), Effect.runPromise);

		expect(newToken).not.toBe(oldToken);

		const result = await Workspaces.joinWorkspaceByToken({
			userId: "late-user",
			inviteToken: oldToken,
		}).pipe(Effect.provide(makeLayer(db)), Effect.runPromiseExit);

		expect(result._tag).toBe("Failure");
	});
});
