/**
 * The REST-only endpoints, behind one call.
 *
 * Most of the app speaks RPC through `rpc-client.ts`, which is typed and knows
 * how failures arrive. A handful of endpoints are not RPC — upload, import,
 * backup, settings, admin — and every one of their call sites issued a raw
 * fetch with its own idea of what a failure looks like. There were three
 * shapes, and the most common one was wrong:
 *
 *     const data = await resp.json();
 *     if (!resp.ok) throw new Error(data.error);
 *
 * It parses before it checks. Any failure whose body is not JSON — an nginx
 * 502, a proxy timeout page, an HTML 500 — throws inside `json()` first, and
 * the user is told "Unexpected token <" instead of what went wrong. Which is
 * exactly the shape of the upload outage in NOT-123.
 *
 * Deliberately NOT routed through here: the liveness poll during a restore
 * (expects failure while the server restarts) and presence heartbeat/leave
 * (fire-and-forget, must not raise). Those raw fetches carry a comment saying
 * so.
 */
import { getCurrentWorkspaceId } from "../rpc-client.js";

/** A REST call that failed, carrying whatever the server managed to say. */
export class RestError extends Error {
	readonly _tag = "RestError";
	constructor(
		readonly status: number,
		message: string,
	) {
		super(message);
		this.name = "RestError";
	}
}

/**
 * Read a failure body without trusting it.
 *
 * Tries JSON, falls back to text, then to the status line. Never throws — an
 * error handler that fails is worse than the error it was handling.
 */
async function failureMessage(response: Response): Promise<string> {
	// The status number is always in the fallback: a user reporting "Service
	// Unavailable" cannot tell you which code they saw, and 502 and 503 mean
	// very different things about where the failure is.
	const fallback = response.statusText
		? `${response.status} ${response.statusText}`
		: `Request failed with status ${response.status}`;
	try {
		const text = await response.text();
		if (!text) return fallback;
		try {
			const parsed = JSON.parse(text);
			return parsed?.error || parsed?.message || text;
		} catch {
			// Not JSON: a proxy error page, or a bare string. Keep it short — the
			// whole of an HTML error page is not a useful toast.
			return text.length > 300 ? `${text.slice(0, 300)}…` : text;
		}
	} catch {
		return fallback;
	}
}

/**
 * Call a REST endpoint and return its parsed body.
 *
 * Adds `X-Workspace-Id` when a workspace is open, so no caller has to remember.
 * A body given as a JSON string gets a JSON content type unless the caller set
 * one — upload and import send raw bytes and choose their own.
 *
 * Returns null for an empty body, which is what a 204 answers with.
 */
export async function restCall<T = unknown>(
	path: string,
	init: RequestInit = {},
): Promise<T> {
	const headers: Record<string, string> = {
		...(init.headers as Record<string, string> | undefined),
	};

	if (typeof init.body === "string" && !headers["Content-Type"]) {
		headers["Content-Type"] = "application/json";
	}

	const workspaceId = getCurrentWorkspaceId();
	if (workspaceId && !headers["X-Workspace-Id"]) {
		headers["X-Workspace-Id"] = workspaceId;
	}

	const response = await fetch(path, { ...init, headers });

	if (!response.ok) {
		throw new RestError(response.status, await failureMessage(response));
	}

	const text = await response.text();
	if (!text) return null as T;
	try {
		return JSON.parse(text) as T;
	} catch {
		return text as T;
	}
}
