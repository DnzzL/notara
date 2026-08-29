/**
 * Turning a request into a `CurrentUser`.
 *
 * Two credentials reach this server and, until now, took two different paths
 * with two different error types: the session cookie through
 * `getSessionUser` (failing with the shared `AuthError`) and the API key
 * through `api-v1/auth.ts` (failing with a second, local `ApiError` class).
 * Callers therefore had to know which door a request came through in order to
 * know what a failure looked like.
 *
 * Here they are two adapters at one seam. A third — a principal handed
 * straight to a test — needs no code at all: `Layer.succeed(CurrentUser, ...)`.
 * Three adapters, so the seam is real rather than hypothetical.
 *
 * Precedence is API key before cookie: a request carrying an explicit
 * `Authorization` header meant to use it, and silently preferring an ambient
 * cookie would make the effective identity depend on browser state the caller
 * cannot see.
 */

import { AuthError } from "@notara/shared";
import { type Context, Effect, Layer } from "effect";
import { HttpServerRequest } from "effect/unstable/http";
import { sha256 } from "./api-v1/auth.js";
import { auth } from "./auth.js";
import { PlatformDb } from "./platform-db.js";
import { CurrentUser } from "./policy.js";

export type Principal = Context.Service.Shape<typeof CurrentUser>;

type Resolved = Principal | null;

const headersOf = (request: HttpServerRequest.HttpServerRequest): Headers => {
	const headers = new Headers();
	for (const [key, value] of Object.entries(request.headers)) {
		if (typeof value === "string") headers.set(key, value);
	}
	return headers;
};

/**
 * `Authorization: Bearer ntr_...`.
 *
 * Null when the header is absent — that is "no opinion", not "refused", so the
 * cookie adapter still gets a turn. A *present but invalid* key is a refusal:
 * falling back to the cookie there would let a revoked key silently act as
 * whoever happens to be logged in.
 */
export const fromApiKey: Effect.Effect<
	Resolved,
	AuthError,
	HttpServerRequest.HttpServerRequest | PlatformDb
> = Effect.gen(function* () {
	const request = yield* HttpServerRequest.HttpServerRequest;
	const header = request.headers.authorization as string | undefined;
	if (!header?.startsWith("Bearer ")) return null;

	const db = yield* PlatformDb;
	const key = db
		.prepare("SELECT id, user_id FROM api_keys WHERE key_hash = ?")
		.get(sha256(header.slice(7))) as { id: string; user_id: string } | null;

	if (!key) {
		return yield* Effect.fail(
			new AuthError({ status: 401, message: "Invalid API key" }),
		);
	}

	db.prepare("UPDATE api_keys SET last_used_at = ? WHERE id = ?").run(
		new Date().toISOString(),
		key.id,
	);

	// The principal carries an email because the admin gate compares one. A key
	// whose user has since been deleted resolves to nothing rather than to a
	// principal with a blank identity.
	const user = db
		.prepare('SELECT email FROM "user" WHERE id = ?')
		.get(key.user_id) as { email: string } | null;

	if (!user) {
		return yield* Effect.fail(
			new AuthError({ status: 401, message: "Invalid API key" }),
		);
	}

	return { userId: key.user_id, email: user.email };
});

/** The Better Auth session cookie. Null when there is no valid session. */
export const fromSession: Effect.Effect<
	Resolved,
	never,
	HttpServerRequest.HttpServerRequest
> = Effect.gen(function* () {
	const request = yield* HttpServerRequest.HttpServerRequest;
	const session = yield* Effect.promise(() =>
		auth.api.getSession({ headers: headersOf(request) }),
	);
	return session
		? { userId: session.user.id, email: session.user.email }
		: null;
});

/**
 * The caller, by whichever credential they presented. Fails 401 when neither
 * adapter recognises them.
 */
export const fromRequest: Effect.Effect<
	Principal,
	AuthError,
	HttpServerRequest.HttpServerRequest | PlatformDb
> = Effect.gen(function* () {
	const byKey = yield* fromApiKey;
	if (byKey) return byKey;

	const bySession = yield* fromSession;
	if (bySession) return bySession;

	return yield* Effect.fail(
		new AuthError({
			status: 401,
			message:
				"Unauthorized — provide a session cookie or Authorization: Bearer <api-key>",
		}),
	);
});

/** `CurrentUser` for the duration of one request. */
export const layer: Layer.Layer<
	CurrentUser,
	AuthError,
	HttpServerRequest.HttpServerRequest | PlatformDb
> = Layer.effect(CurrentUser, fromRequest);
