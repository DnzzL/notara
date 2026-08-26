import { HttpServerRequest } from "@effect/platform";
import { AuthError } from "@notara/shared";
import { Effect } from "effect";
import { auth } from "./auth.js";
import { WorkspaceDb } from "./db.js";
import * as Membership from "./membership.js";

export const resolveWorkspaceContext = (workspaceId: string) =>
	Effect.gen(function* () {
		const request = yield* HttpServerRequest.HttpServerRequest;

		const headers = new Headers();
		for (const [k, v] of Object.entries(request.headers)) {
			if (typeof v === "string") headers.set(k, v);
		}

		const session = yield* Effect.promise(() =>
			auth.api.getSession({ headers }),
		);
		if (!session) {
			return yield* Effect.fail(
				new AuthError({ status: 401, message: "Unauthorized" }),
			);
		}

		const userId = session.user.id;

		const role = yield* Membership.roleOf(userId, workspaceId);
		if (role === null) {
			return yield* Effect.fail(
				new AuthError({ status: 403, message: "Forbidden" }),
			);
		}

		return { userId, workspaceId, role };
	});

export const getSessionUser = Effect.gen(function* () {
	const request = yield* HttpServerRequest.HttpServerRequest;
	const headers = new Headers();
	for (const [k, v] of Object.entries(request.headers)) {
		if (typeof v === "string") headers.set(k, v);
	}
	const session = yield* Effect.promise(() => auth.api.getSession({ headers }));
	if (!session) {
		return yield* Effect.fail(
			new AuthError({ status: 401, message: "Unauthorized" }),
		);
	}
	return session.user;
});

/**
 * Membership check against a workspace id taken from the *request payload*
 * rather than the X-Workspace-Id header — the workspace-settings screens call
 * the membership RPCs without that header set.
 *
 * Yields the caller's role so owner-only actions can gate on it.
 */
export const requireWorkspaceRole = (workspaceId: string) =>
	Effect.gen(function* () {
		const user = yield* getSessionUser;
		const role = yield* Membership.roleOf(user.id, workspaceId);
		if (role === null) {
			return yield* Effect.fail(
				new AuthError({ status: 403, message: "Not a workspace member" }),
			);
		}
		return role;
	});

/** Same, but rejects anyone who is not the workspace owner. */
export const requireWorkspaceOwner = (workspaceId: string) =>
	Effect.gen(function* () {
		const role = yield* requireWorkspaceRole(workspaceId);
		if (role !== "owner") {
			return yield* Effect.fail(
				new AuthError({
					status: 403,
					message: "Workspace owner role required",
				}),
			);
		}
	});

/**
 * Authenticated user + workspace context. Yields { userId, workspaceId, role }
 * to the inner builder, runs it with the per-workspace SqlClient layer applied.
 */
export const withAuthedWorkspace = <A, E, R>(
	build: (ctx: {
		userId: string;
		workspaceId: string;
		role: "owner" | "member";
	}) => Effect.Effect<A, E, R>,
) =>
	Effect.gen(function* () {
		const user = yield* getSessionUser;
		const request = yield* HttpServerRequest.HttpServerRequest;
		const workspaceId = request.headers["x-workspace-id"] as string | undefined;
		if (!workspaceId)
			return yield* Effect.die(new Error("Missing X-Workspace-Id header"));
		const role = yield* Membership.roleOf(user.id, workspaceId);
		if (role === null) {
			return yield* Effect.fail(
				new AuthError({ status: 403, message: "Not a workspace member" }),
			);
		}
		const wdb = yield* WorkspaceDb;
		return yield* build({
			userId: user.id,
			workspaceId,
			role,
		}).pipe(Effect.provide(wdb.getLayer(workspaceId)));
	});
