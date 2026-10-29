import { createHash, randomBytes } from "node:crypto";
import { AuthError } from "@notara/shared";
import { Data, Effect } from "effect";
import * as HttpServerRequest from "effect/http/HttpServerRequest";
import { auth } from "../auth.js";
import * as Membership from "../membership.js";
import { PlatformDb } from "../platform-db.js";
import type { ApiKeyScope } from "./scope.js";

// ── Error type ────────────────────────────────────────────────────────────────

export class ApiError extends Data.TaggedError("ApiError")<{
	readonly status: number;
	readonly message: string;
}> {}

// ── Key generation helpers ────────────────────────────────────────────────────

export const sha256 = (s: string) =>
	createHash("sha256").update(s).digest("hex");

/** Generate a fresh API key: `ntr_<32 random hex chars>`. */
export const generateApiKey = (): {
	raw: string;
	hash: string;
	prefix: string;
} => {
	const raw = `ntr_${randomBytes(16).toString("hex")}`;
	return { raw, hash: sha256(raw), prefix: raw.slice(0, 10) };
};

// ── Authenticated user ────────────────────────────────────────────────────────

/** `scope` is absent for a cookie session, which is unscoped. */
export type ApiUser = {
	userId: string;
	keyId: string | null;
	scope?: ApiKeyScope;
};

/** The caller behind an API key, and what the key may do. */
export type ApiKey = { userId: string; keyId: string; scope: ApiKeyScope };

/**
 * Resolves `Authorization: Bearer ntr_...` to its key, and nothing else: a
 * cookie session is not a credential here. The one key lookup every door goes
 * through (REST via resolveApiUser, MCP directly), so revoking a key cuts off
 * all of them.
 *
 * Fails with `AuthError(401)` when the header is missing or the key unknown.
 */
export const resolveApiKey = (
	req: HttpServerRequest.HttpServerRequest,
): Effect.Effect<ApiKey, AuthError, PlatformDb> =>
	Effect.gen(function* () {
		const authHeader = req.headers.authorization as string | undefined;
		if (!authHeader?.startsWith("Bearer ")) {
			return yield* Effect.fail(
				new AuthError({
					status: 401,
					message: "Unauthorized — provide Authorization: Bearer <api-key>",
				}),
			);
		}

		const db = yield* PlatformDb;
		const key = db
			.prepare("SELECT id, user_id, scope FROM api_keys WHERE key_hash = ?")
			.get(sha256(authHeader.slice(7))) as {
			id: string;
			user_id: string;
			scope: ApiKeyScope;
		} | null;

		if (!key) {
			return yield* Effect.fail(
				new AuthError({ status: 401, message: "Invalid API key" }),
			);
		}

		db.prepare("UPDATE api_keys SET last_used_at = ? WHERE id = ?").run(
			new Date().toISOString(),
			key.id,
		);

		return { userId: key.user_id, keyId: key.id, scope: key.scope };
	});

/**
 * Resolves the calling user from either:
 *   1. `Authorization: Bearer ntr_...`  — API key (resolveApiKey)
 *   2. Session cookie set by Better Auth
 *
 * Fails with a 401 if neither is valid.
 */
export const resolveApiUser: Effect.Effect<
	ApiUser,
	ApiError | AuthError,
	PlatformDb | HttpServerRequest.HttpServerRequest
> = Effect.gen(function* () {
	const req = yield* HttpServerRequest.HttpServerRequest;

	if (
		(req.headers.authorization as string | undefined)?.startsWith("Bearer ")
	) {
		return yield* resolveApiKey(req);
	}

	const headers = new Headers(req.headers as Record<string, string>);
	const session = yield* Effect.promise(() => auth.api.getSession({ headers }));
	if (!session) {
		return yield* Effect.fail(
			new ApiError({
				status: 401,
				message:
					"Unauthorized — provide a session cookie or Authorization: Bearer <api-key>",
			}),
		);
	}

	return { userId: session.user.id, keyId: null };
});

// ── Workspace membership check ────────────────────────────────────────────────

/**
 * Verifies the user is a member of the workspace and returns their role.
 * Fails with `AuthError(403)` if not.
 */
export const requireWorkspaceMember = (workspaceId: string, userId: string) =>
	Effect.gen(function* () {
		const role = yield* Membership.roleOf(userId, workspaceId);
		if (role === null) {
			return yield* Effect.fail(
				new AuthError({
					status: 403,
					message: "Not a member of this workspace",
				}),
			);
		}
		return role;
	});
