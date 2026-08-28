import * as HttpServerRequest from "@effect/platform/HttpServerRequest";
import * as HttpServerResponse from "@effect/platform/HttpServerResponse";
import { isApiError } from "@notara/shared";
import { Effect, Layer } from "effect";
import { type WorkspaceDb, WorkspaceDbLive } from "../db.js";
import { failureResponse } from "../http-error.js";
import { corsHeaders } from "../middleware.js";
import { type PlatformDb, PlatformDbLive } from "../platform-db.js";
import { ApiError } from "./auth.js";
import { enforceScope } from "./scope.js";

/**
 * Singleton services the v1 handlers need at request time. The HttpLayerRouter
 * runs each route handler with only the *output* context of the served layer,
 * and these zero-dependency `Layer.succeed` services aren't re-exported by the
 * app layer (it `Layer.provide`s them as inputs). So we provide them here, at
 * the handler boundary, where `withWorkspace` supplies the per-request SqlClient
 * on top.
 */
const RequestServices = Layer.mergeAll(PlatformDbLive, WorkspaceDbLive);

const JSON_HEADER = { "Content-Type": "application/json", ...corsHeaders };

// ── Successful responses ──────────────────────────────────────────────────────

export const ok = <T>(data: T) =>
	HttpServerResponse.text(JSON.stringify(data), { headers: JSON_HEADER });

export const created = <T>(data: T) =>
	HttpServerResponse.text(JSON.stringify(data), {
		status: 201,
		headers: JSON_HEADER,
	});

export const noContent = () => HttpServerResponse.empty({ status: 204 });

// ── Error responses ───────────────────────────────────────────────────────────

export const apiError = (status: number, message: string) =>
	HttpServerResponse.text(JSON.stringify({ error: message }), {
		status,
		headers: JSON_HEADER,
	});

// ── Request helpers ───────────────────────────────────────────────────────────

/** Parse request body as JSON; fails with ApiError(400) on malformed input. */
export const parseBody = Effect.gen(function* () {
	const req = yield* HttpServerRequest.HttpServerRequest;
	const ab = yield* req.arrayBuffer;
	try {
		return JSON.parse(Buffer.from(ab).toString("utf-8")) as unknown;
	} catch {
		return yield* Effect.fail(
			new ApiError({ status: 400, message: "Invalid JSON body" }),
		);
	}
});

/** Parse a required string field from a parsed JSON body. */
export const requireField = (
	body: unknown,
	field: string,
): Effect.Effect<string, ApiError, never> => {
	const value = (body as Record<string, unknown>)?.[field];
	if (typeof value !== "string" || value.trim() === "") {
		return Effect.fail(
			new ApiError({
				status: 422,
				message: `Field "${field}" is required and must be a non-empty string`,
			}),
		);
	}
	return Effect.succeed(value);
};

/** Parse an optional string field from a parsed JSON body. */
export const optionalField = (body: unknown, field: string): string | null => {
	const value = (body as Record<string, unknown>)?.[field];
	return typeof value === "string" ? value : null;
};

/** Parse query string from current request URL. */
export const queryParam = (name: string) =>
	Effect.gen(function* () {
		const req = yield* HttpServerRequest.HttpServerRequest;
		const url = new URL(req.url, "http://x");
		return url.searchParams.get(name);
	});

// ── Error boundary ────────────────────────────────────────────────────────────

/**
 * Wraps a handler Effect so that:
 *  - `ApiError` failures become proper JSON 4xx/5xx responses
 *  - the shared typed failures raised by the RPC handlers this surface reuses
 *    (NotFoundError, ConflictError, ...) keep their own status too
 *  - Any other error becomes a 500 JSON response
 *  - Unexpected defects also return a 500 JSON response
 */
export const handle = <R>(
	handler: Effect.Effect<HttpServerResponse.HttpServerResponse, unknown, R>,
): Effect.Effect<
	HttpServerResponse.HttpServerResponse,
	never,
	// The scope check needs the request, which the router supplies per request
	// just as it does for handlers — so it is required, not excluded.
	HttpServerRequest.HttpServerRequest | Exclude<R, PlatformDb | WorkspaceDb>
> =>
	// The scope check runs before the handler, and before anything it might do.
	// Here rather than per route: every v1 route already goes through handle, so
	// a new one is covered the moment it is registered.
	Effect.zipRight(enforceScope, handler).pipe(
		Effect.catchAll((e) => {
			if (e instanceof ApiError)
				return Effect.succeed(apiError(e.status, e.message));
			if (isApiError(e)) return Effect.succeed(failureResponse(e));
			return Effect.succeed(apiError(500, String(e)));
		}),
		Effect.catchAllCause((cause) =>
			Effect.succeed(
				apiError(
					500,
					cause._tag === "Fail"
						? String((cause as any).error)
						: "Internal server error",
				),
			),
		),
		Effect.provide(RequestServices),
	);

/** Extract a required URL path param; fails with ApiError(400) if missing. */
export const requireParam = (
	routeParams: Readonly<Record<string, string | undefined>>,
	name: string,
): Effect.Effect<string, ApiError, never> => {
	const v = routeParams[name];
	if (!v)
		return Effect.fail(
			new ApiError({ status: 400, message: `Missing path parameter: ${name}` }),
		);
	return Effect.succeed(v);
};
