/**
 * The REST v1 surface, driven the way the router drives it: each operation's
 * route handler runs against a real request, through the same scope check and
 * error mapping as production (`respond`), with a
 * throwaway platform database (users, membership, API keys) and workspace
 * database behind it. Auth, the key's scope, membership, the permission check
 * and the operation all run — nothing below the seam is called directly.
 */
import { Database } from "bun:sqlite";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { SqliteClient } from "@effect/sql-sqlite-bun";
import { Effect, Layer } from "effect";
import * as HttpRouter from "effect/http/HttpRouter";
import * as HttpServerRequest from "effect/http/HttpServerRequest";
import * as HttpServerResponse from "effect/http/HttpServerResponse";
import type { SqlClient } from "effect/sql";
import { sha256 } from "../src/api-v1/auth.js";
import { operationHandler, restOperations } from "../src/api-v1/operations.js";
import { respond } from "../src/api-v1/response.js";
import { WorkspaceDb } from "../src/db.js";
import { addMember } from "../src/member-handles.js";
import { PlatformDb, runPlatformMigrations } from "../src/platform-db.js";

const migrationsDir = path.join(
	import.meta.dirname || __dirname,
	"../migrations",
);

/** The path params `routePath` captures from `url`, or null when it does not match. */
const match = (routePath: string, url: string) => {
	const want = routePath.split("/");
	const got = url.split("?")[0].split("/");
	if (want.length !== got.length) return null;
	const params: Record<string, string> = {};
	for (let i = 0; i < want.length; i++) {
		if (want[i].startsWith(":")) params[want[i].slice(1)] = got[i];
		else if (want[i] !== got[i]) return null;
	}
	return params;
};

export const WORKSPACE = "ws";

/**
 * A workspace `ws` with members `ann` (owner) and `bob`, whose handles are
 * their names, an outsider `eve`, and keys:
 * `write` (ann's, named "docket"), `read` (ann's, read scope), `eve` (eve's).
 */
export function restWorkspace() {
	const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "notara-rest-"));
	const filename = path.join(tmpDir, "workspace.db");
	const wdb = new Database(filename);
	for (const file of fs
		.readdirSync(migrationsDir)
		.filter((f) => f.endsWith(".sql"))
		.sort())
		wdb.exec(fs.readFileSync(path.join(migrationsDir, file), "utf-8"));
	wdb.close();

	const platform = new Database(path.join(tmpDir, "platform.db"));
	runPlatformMigrations(platform);
	const now = new Date().toISOString();
	for (const [id, email] of [
		["ann", "ann@example.test"],
		["bob", "bob@example.test"],
		["eve", "eve@example.test"],
	])
		platform
			.prepare(
				`INSERT INTO "user" (id, name, email, "createdAt", "updatedAt") VALUES (?, ?, ?, ?, ?)`,
			)
			.run(id, id, email, now, now);
	platform
		.prepare(
			"INSERT INTO workspaces (id, name, slug, owner_id, invite_token) VALUES (?, 'W', 'w', 'ann', 'tok')",
		)
		.run(WORKSPACE);
	addMember(platform, WORKSPACE, "ann", "owner", now);
	addMember(platform, WORKSPACE, "bob", "member", now);
	for (const [token, user, name, scope] of [
		["write", "ann", "docket", "write"],
		["read", "ann", "reader", "read"],
		["eve", "eve", "eve's key", "write"],
	])
		platform
			.prepare(
				"INSERT INTO api_keys (id, user_id, name, key_hash, key_prefix, scope) VALUES (?, ?, ?, ?, ?, ?)",
			)
			.run(token, user, name, sha256(token), token, scope);

	const sqlLayer = SqliteClient.layer({ filename });
	const services = Layer.mergeAll(
		Layer.succeed(PlatformDb, platform),
		Layer.succeed(WorkspaceDb, { getLayer: () => sqlLayer }),
	);

	/** Run an effect against the workspace and platform databases directly. */
	const run = <A, E>(
		eff: Effect.Effect<A, E, SqlClient.SqlClient | PlatformDb>,
	) =>
		eff.pipe(
			Effect.provide(
				Layer.merge(sqlLayer, Layer.succeed(PlatformDb, platform)),
			),
			Effect.runPromise,
		);

	/** Call the API as the bearer of `key` (one of write, read, eve). */
	const call = async (
		method: string,
		url: string,
		opts: { key: string; body?: unknown },
	) => {
		const found = restOperations
			.map((op) => ({
				op,
				params: op.method === method ? match(op.path, url) : null,
			}))
			.find((x) => x.params !== null);
		if (!found?.params) throw new Error(`no route for ${method} ${url}`);
		const request = HttpServerRequest.fromWeb(
			new Request(`http://test${url}`, {
				method,
				headers: { authorization: `Bearer ${opts.key}` },
				body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
			}),
		);
		// Operation.run is typed `any` in R (operations.ts); these are the
		// services a matched route actually needs.
		const routed = respond(operationHandler(found.op)) as Effect.Effect<
			HttpServerResponse.HttpServerResponse,
			never,
			| HttpServerRequest.HttpServerRequest
			| HttpRouter.RouteContext
			| PlatformDb
			| WorkspaceDb
		>;
		const response = await routed.pipe(
			Effect.provideService(HttpServerRequest.HttpServerRequest, request),
			Effect.provideService(HttpRouter.RouteContext, {
				params: found.params,
				route: undefined as never,
			}),
			Effect.provide(services),
			Effect.runPromise,
		);
		const web = HttpServerResponse.toWeb(response);
		const text = await web.text();
		return { status: web.status, json: text ? JSON.parse(text) : null };
	};

	return {
		run,
		fail: <A, E>(eff: Effect.Effect<A, E, SqlClient.SqlClient | PlatformDb>) =>
			run(Effect.flip(eff)),
		call,
		[Symbol.dispose]: () => {
			platform.close();
			fs.rmSync(tmpDir, { recursive: true, force: true });
		},
	};
}
