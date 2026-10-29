import { Effect, Layer } from "effect";
import * as HttpServerResponse from "effect/http/HttpServerResponse";
import { type WorkspaceDb, WorkspaceDbLive } from "../db.js";
import { causeResponse } from "../http-error.js";
import { corsHeaders } from "../middleware.js";
import { type PlatformDb, PlatformDbLive } from "../platform-db.js";
import { ApiError } from "./auth.js";

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

// ── Error boundary ────────────────────────────────────────────────────────────

/**
 * Wraps a handler Effect so that:
 *  - `ApiError` failures become proper JSON 4xx/5xx responses
 *  - everything else goes through `causeResponse`, the server's one error
 *    boundary: a declared failure (NotFoundError, ConflictError, ...) keeps its
 *    own status, anything undeclared is reported and answered with a 500
 */
export const handle = <R>(
	handler: Effect.Effect<HttpServerResponse.HttpServerResponse, unknown, R>,
): Effect.Effect<
	HttpServerResponse.HttpServerResponse,
	never,
	Exclude<R, PlatformDb | WorkspaceDb>
> =>
	handler.pipe(
		Effect.catchIf(
			(e): e is ApiError => e instanceof ApiError,
			(e) => Effect.succeed(apiError(e.status, e.message)),
		),
		Effect.catchCause(causeResponse),
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
