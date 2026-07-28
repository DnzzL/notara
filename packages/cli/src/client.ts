import * as HttpClient from "@effect/platform/HttpClient";
import * as HttpClientRequest from "@effect/platform/HttpClientRequest";
import { Data, Effect } from "effect";

/** A user-facing error: anything that should be printed as a clean message,
 *  not a stack trace (auth problems, HTTP 4xx/5xx, network failures). */
export class NotaraError extends Data.TaggedError("NotaraError")<{
	readonly message: string;
}> {}

/** Resolved connection settings, built from CLI flags + env vars. */
export interface Cfg {
	readonly url: string;
	readonly token: string;
	readonly workspace: string;
}

export type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

const ctor: Record<
	Method,
	(url: string) => HttpClientRequest.HttpClientRequest
> = {
	GET: HttpClientRequest.get,
	POST: HttpClientRequest.post,
	PUT: HttpClientRequest.put,
	PATCH: HttpClientRequest.patch,
	DELETE: HttpClientRequest.del,
};

/** A workspace id is required for everything except `workspaces list`. */
export const requireWorkspace = (
	cfg: Cfg,
): Effect.Effect<string, NotaraError> =>
	cfg.workspace
		? Effect.succeed(cfg.workspace)
		: Effect.fail(
				new NotaraError({
					message:
						"No workspace selected. Pass --workspace <id> or set NOTARA_WORKSPACE. " +
						"List them with: notara workspaces list",
				}),
			);

interface Options {
	readonly body?: unknown;
	readonly query?: Record<string, string>;
}

/**
 * Perform an authenticated request against the Notara REST API (`/api/v1`).
 * Returns the parsed JSON body, or `null` for 204 responses. All failures —
 * missing token, network errors, non-2xx status — surface as `NotaraError`.
 */
export const request = (
	cfg: Cfg,
	method: Method,
	path: string,
	options: Options = {},
): Effect.Effect<unknown, NotaraError, HttpClient.HttpClient> =>
	Effect.gen(function* () {
		if (!cfg.token) {
			return yield* new NotaraError({
				message:
					"No API key. Pass --token <key> or set NOTARA_API_KEY. " +
					"Create a key in Notara → Settings → API keys (format: ntr_...).",
			});
		}

		const client = yield* HttpClient.HttpClient;

		let req = ctor[method](`${cfg.url}${path}`).pipe(
			HttpClientRequest.setHeader("Authorization", `Bearer ${cfg.token}`),
			HttpClientRequest.acceptJson,
		);
		if (options.query)
			req = req.pipe(HttpClientRequest.setUrlParams(options.query));
		if (options.body !== undefined)
			req = yield* HttpClientRequest.bodyJson(req, options.body);

		const res = yield* client.execute(req);

		if (res.status === 204) return null;

		const text = yield* res.text;

		if (res.status >= 400) {
			let message = text;
			try {
				const parsed = JSON.parse(text) as { error?: string };
				if (typeof parsed.error === "string") message = parsed.error;
			} catch {
				/* keep raw text */
			}
			return yield* new NotaraError({
				message: `HTTP ${res.status}: ${message}`,
			});
		}

		return text ? JSON.parse(text) : null;
	}).pipe(
		Effect.catchAll((e) =>
			e instanceof NotaraError
				? Effect.fail(e)
				: Effect.fail(
						new NotaraError({
							message: `Request failed: ${String((e as { message?: string }).message ?? e)}`,
						}),
					),
		),
	);
