/**
 * Member handles (NOT-151): every workspace member has a handle, unique in the
 * workspace, derived from their name and changeable — what `@` mentions name.
 */
import { Database } from "bun:sqlite";
import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Effect, Layer } from "effect";
import * as Workspaces from "../src/handlers/workspaces.js";
import { PlatformDb, runPlatformMigrations } from "../src/platform-db.js";

function platform() {
	const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "notara-handles-"));
	const db = new Database(path.join(tmpDir, "platform.db"));
	runPlatformMigrations(db);
	const now = new Date().toISOString();
	for (const [id, name] of [
		["u1", "Thomas Legrand"],
		["u2", "Thomas Martin"],
		["u3", "Éloïse"],
		["u4", "🚀"],
	])
		db.prepare(
			`INSERT INTO "user" (id, name, email, "createdAt", "updatedAt") VALUES (?, ?, ?, ?, ?)`,
		).run(id, name, `${id}@example.test`, now, now);
	const run = <A, E>(eff: Effect.Effect<A, E, PlatformDb>) =>
		eff.pipe(Effect.provide(Layer.succeed(PlatformDb, db)), Effect.runPromise);
	return {
		db,
		run,
		fail: <A, E>(eff: Effect.Effect<A, E, PlatformDb>) => run(Effect.flip(eff)),
		[Symbol.dispose]: () => {
			db.close();
			fs.rmSync(tmpDir, { recursive: true, force: true });
		},
	};
}

/** A workspace owned by u1, joined by u2, u3 and u4. */
const team = async (p: ReturnType<typeof platform>) => {
	const ws = await p.run(
		Workspaces.createWorkspace({ userId: "u1", name: "W", slug: "w" }),
	);
	const token = (
		p.db
			.prepare("SELECT invite_token FROM workspaces WHERE id = ?")
			.get(ws.id) as {
			invite_token: string;
		}
	).invite_token;
	for (const userId of ["u2", "u3", "u4"])
		await p.run(
			Workspaces.joinWorkspaceByToken({ userId, inviteToken: token }),
		);
	return ws;
};

const handles = async (p: ReturnType<typeof platform>, workspaceId: string) =>
	Object.fromEntries(
		(await p.run(Workspaces.getWorkspaceMembers(workspaceId))).map((m) => [
			m.userId,
			m.handle,
		]),
	);

describe("member handles", () => {
	test("a member's handle comes from their first name, unique in the workspace", async () => {
		using p = platform();
		const ws = await team(p);
		expect(await handles(p, ws.id)).toEqual({
			u1: "thomas",
			u2: "thomas2",
			u3: "eloise",
			u4: "member",
		});
	});

	test("a member changes their handle", async () => {
		using p = platform();
		const ws = await team(p);
		await p.run(
			Workspaces.setMemberHandle({
				workspaceId: ws.id,
				userId: "u2",
				handle: "Tom",
			}),
		);
		expect((await handles(p, ws.id)).u2).toBe("tom");
	});

	test("a handle someone else holds is refused", async () => {
		using p = platform();
		const ws = await team(p);
		const err = await p.fail(
			Workspaces.setMemberHandle({
				workspaceId: ws.id,
				userId: "u2",
				handle: "thomas",
			}),
		);
		expect(err._tag).toBe("ConflictError");
	});

	test("a malformed handle is refused", async () => {
		using p = platform();
		const ws = await team(p);
		for (const bad of ["", "a", "-x", "has space", "x".repeat(31)]) {
			const err = await p.fail(
				Workspaces.setMemberHandle({
					workspaceId: ws.id,
					userId: "u2",
					handle: bad,
				}),
			);
			expect(err._tag, bad).toBe("ValidationError");
		}
	});

	test("members who joined before handles existed get one", async () => {
		using p = platform();
		const ws = await team(p);
		p.db.prepare("UPDATE workspace_members SET handle = NULL").run();
		runPlatformMigrations(p.db);
		expect(await handles(p, ws.id)).toEqual({
			u1: "thomas",
			u2: "thomas2",
			u3: "eloise",
			u4: "member",
		});
	});
});
