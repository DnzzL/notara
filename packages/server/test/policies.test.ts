/**
 * The application's policies, asserted without a server.
 *
 * These are the checks that guard every RPC method and REST route. Until the
 * Policy module they could only be exercised through a booted server and a real
 * cookie, so in practice they were exercised end-to-end or not at all — and
 * `api-v1/routes.ts` chose not at all.
 */
import { Database } from "bun:sqlite";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { SqliteClient } from "@effect/sql-sqlite-bun";
import type { AuthError } from "@notara/shared";
import { Effect, Exit, Layer } from "effect";
import * as Pages from "../src/handlers/pages.js";
import * as Permissions from "../src/handlers/permissions.js";
import { PlatformDb, runPlatformMigrations } from "../src/platform-db.js";
import * as Policies from "../src/policies.js";
import { CurrentUser, withPolicy } from "../src/policy.js";

let tmpDir: string;
let platformDb: Database;
let sqliteFilename: string;
let ownerWs: string;
let strangerWs: string;

const OWNER = "policies-owner";
const MEMBER = "policies-member";
const STRANGER = "policies-stranger";

function seedUser(db: Database, id: string) {
	const now = new Date().toISOString();
	db.prepare(
		'INSERT OR IGNORE INTO "user" (id, name, email, "createdAt", "updatedAt") VALUES (?, ?, ?, ?, ?)',
	).run(id, id, `${id}@test.com`, now, now);
}

beforeAll(() => {
	tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "notara-policies-"));
	platformDb = new Database(path.join(tmpDir, "platform.db"));
	runPlatformMigrations(platformDb);

	sqliteFilename = path.join(tmpDir, "data.db");
	const workspaceDb = new Database(sqliteFilename);
	const migrationsDir = path.join(
		import.meta.dirname || __dirname,
		"../migrations",
	);
	for (const file of fs
		.readdirSync(migrationsDir)
		.filter((f) => f.endsWith(".sql"))
		.sort()) {
		workspaceDb.exec(fs.readFileSync(path.join(migrationsDir, file), "utf-8"));
	}
	workspaceDb.close();

	for (const id of [OWNER, MEMBER, STRANGER]) seedUser(platformDb, id);

	const now = new Date().toISOString();
	ownerWs = "ws-policies";
	strangerWs = "ws-stranger";
	for (const [id, ownerId] of [
		[ownerWs, OWNER],
		[strangerWs, STRANGER],
	]) {
		platformDb
			.prepare(
				"INSERT INTO workspaces (id, name, slug, owner_id, invite_token, created_at) VALUES (?, ?, ?, ?, ?, ?)",
			)
			.run(id, id, id, ownerId, `inv-${id}`, now);
		platformDb
			.prepare(
				"INSERT INTO workspace_members (workspace_id, user_id, role, joined_at) VALUES (?, ?, 'owner', ?)",
			)
			.run(id, ownerId, now);
	}
	platformDb
		.prepare(
			"INSERT INTO workspace_members (workspace_id, user_id, role, joined_at) VALUES (?, ?, 'member', ?)",
		)
		.run(ownerWs, MEMBER, now);
});

afterAll(() => {
	platformDb.close();
	fs.rmSync(tmpDir, { recursive: true, force: true });
});

const layers = () =>
	Layer.provideMerge(
		Layer.succeed(PlatformDb, platformDb),
		SqliteClient.layer({ filename: sqliteFilename }),
	);

/**
 * Run a guarded effect as `userId`, and report the outcome.
 *
 * The whole point of the Policy module in one line: the caller is a layer, so a
 * test picks who is asking without a server, a cookie or a session store.
 */
const as = <A, E>(userId: string, effect: Effect.Effect<A, E, CurrentUser>) =>
	Effect.runPromise(
		Effect.exit(
			effect.pipe(
				Effect.provide(
					Layer.succeed(CurrentUser, {
						userId,
						email: `${userId}@test.com`,
					}),
				),
			),
		),
	);

const refusal = <A, E>(exit: Exit.Exit<A, E>): AuthError | null =>
	Exit.isFailure(exit)
		? ((exit.cause as unknown as { error: AuthError }).error ?? null)
		: null;

const guarded = <E, R>(p: Effect.Effect<void, E, R>) =>
	Effect.succeed("allowed").pipe(withPolicy(p), Effect.provide(layers()));

describe("workspace policies", () => {
	test("a member passes the member policy", async () => {
		const exit = await as(MEMBER, guarded(Policies.workspaceMember(ownerWs)));
		expect(exit).toEqual(Exit.succeed("allowed"));
	});

	test("a stranger is refused, and told they are not a member", async () => {
		const exit = await as(STRANGER, guarded(Policies.workspaceMember(ownerWs)));
		expect(refusal(exit)?.status).toBe(403);
		expect(refusal(exit)?.message).toBe("Not a member of this workspace");
	});

	test("a plain member is not an owner", async () => {
		const exit = await as(MEMBER, guarded(Policies.workspaceOwner(ownerWs)));
		expect(refusal(exit)?.message).toBe("Workspace owner role required");
	});

	test("the owner passes the owner policy", async () => {
		const exit = await as(OWNER, guarded(Policies.workspaceOwner(ownerWs)));
		expect(exit).toEqual(Exit.succeed("allowed"));
	});

	test("owning one workspace grants nothing in another", async () => {
		// The shape of NOT-102: a caller with a perfectly valid session, acting on
		// a workspace id that is not theirs.
		const exit = await as(OWNER, guarded(Policies.workspaceOwner(strangerWs)));
		expect(refusal(exit)?.status).toBe(403);
	});
});

describe("page policies", () => {
	test("a member may edit an unlocked page, a stranger may not read it", async () => {
		const page = await Pages.createPage({
			title: "Open",
			parentId: null,
		}).pipe(
			Effect.provide(SqliteClient.layer({ filename: sqliteFilename })),
			Effect.runPromise,
		);

		expect(
			await as(MEMBER, guarded(Policies.page(ownerWs, page.id, "editor"))),
		).toEqual(Exit.succeed("allowed"));

		const denied = await as(
			STRANGER,
			guarded(Policies.page(ownerWs, page.id, "viewer")),
		);
		expect(refusal(denied)?.status).toBe(403);
	});

	test("a lock refuses the member it does not name", async () => {
		const page = await Pages.createPage({
			title: "Locked",
			parentId: null,
		}).pipe(
			Effect.provide(SqliteClient.layer({ filename: sqliteFilename })),
			Effect.runPromise,
		);

		await Permissions.writePagePermissions({
			pageId: page.id,
			set: [{ subject: { type: "user", id: OWNER }, relation: "owner" }],
			remove: [],
		}).pipe(Effect.provide(layers()), Effect.runPromise);

		const exit = await as(
			MEMBER,
			guarded(Policies.page(ownerWs, page.id, "viewer")),
		);
		expect(refusal(exit)?.message).toBe("Insufficient permission");
	});

	test("a viewer grant does not carry edit rights", async () => {
		const page = await Pages.createPage({
			title: "Read Only",
			parentId: null,
		}).pipe(
			Effect.provide(SqliteClient.layer({ filename: sqliteFilename })),
			Effect.runPromise,
		);

		await Permissions.writePagePermissions({
			pageId: page.id,
			set: [
				{ subject: { type: "user", id: MEMBER }, relation: "viewer" },
				{ subject: { type: "user", id: OWNER }, relation: "owner" },
			],
			remove: [],
		}).pipe(Effect.provide(layers()), Effect.runPromise);

		expect(
			await as(MEMBER, guarded(Policies.page(ownerWs, page.id, "viewer"))),
		).toEqual(Exit.succeed("allowed"));

		const denied = await as(
			MEMBER,
			guarded(Policies.page(ownerWs, page.id, "editor")),
		);
		expect(refusal(denied)?.message).toBe("Insufficient permission");
	});
});

describe("instance admin", () => {
	const withAdmins = async <A>(value: string, run: () => Promise<A>) => {
		const previous = process.env.ADMIN_EMAILS;
		process.env.ADMIN_EMAILS = value;
		try {
			return await run();
		} finally {
			if (previous === undefined) delete process.env.ADMIN_EMAILS;
			else process.env.ADMIN_EMAILS = previous;
		}
	};

	test("an unconfigured admin list closes rather than opens", async () => {
		// The failure mode of the opposite default is every deployment shipping
		// with an open admin panel.
		const exit = await withAdmins("", () =>
			as(OWNER, guarded(Policies.instanceAdmin)),
		);
		expect(refusal(exit)?.message).toBe("Admin not configured");
	});

	test("a listed email passes and an unlisted one does not", async () => {
		await withAdmins(`${OWNER}@test.com`, async () => {
			expect(await as(OWNER, guarded(Policies.instanceAdmin))).toEqual(
				Exit.succeed("allowed"),
			);
			const denied = await as(MEMBER, guarded(Policies.instanceAdmin));
			expect(refusal(denied)?.status).toBe(403);
		});
	});

	test("entries are trimmed, so a spaced list still works", async () => {
		await withAdmins(`someone@else.com, ${MEMBER}@test.com`, async () => {
			expect(await as(MEMBER, guarded(Policies.instanceAdmin))).toEqual(
				Exit.succeed("allowed"),
			);
		});
	});
});
