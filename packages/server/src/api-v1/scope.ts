/**
 * What an API key is allowed to do.
 *
 * A key used to authenticate as its owner and carry every right that user had,
 * so one handed to a CI job could delete a workspace as readily as list pages.
 * Two scopes fix that: `read` may only read, `write` may do anything its owner
 * can. See ADR-008 for why this is the one axis that does not reduce to a
 * relation, and NOT-124 for why it is two values rather than six.
 *
 * ENFORCEMENT IS ONE CHOKEPOINT. Every v1 route goes through `handle`, which
 * refuses a write-scoped route carried by a read key, rather than each
 * operation checking for itself. Twenty-eight opportunities to forget a guard
 * is precisely the shape of NOT-102, where one handler never wrote the check
 * its neighbours had.
 *
 * The scope a route needs is what its operation declares (NOT-169), never what
 * its HTTP method suggests: MCP has no method, and both doors must agree.
 */

import { Effect } from "effect";
import * as HttpServerRequest from "effect/http/HttpServerRequest";
import { PlatformDb } from "../platform-db.js";
import { ApiError, sha256 } from "./auth.js";

export type ApiKeyScope = "read" | "write";

/** The refusal, worded so the holder knows what to do about it. */
export const SCOPE_REFUSAL =
	"This API key is read-only. Create a key with write scope to make changes.";

// ── The chokepoint ───────────────────────────────────────────────────────────

/**
 * Refuse a mutating request carried by a read-only key.
 *
 * Runs from `handle`, which every v1 route already goes through, so a new route
 * is covered the moment it is registered rather than when someone remembers.
 *
 * `needed` is the scope the operation declares.
 *
 * Deliberately narrow: it answers "may this credential mutate", not "who is
 * this". Resolving the caller stays in resolveApiUser, where ADR-008 put it.
 *
 * A cookie session is unscoped by construction — it is the user themselves, and
 * whatever they may do through the UI they may do here.
 */
export const enforceScope = (
	needed: ApiKeyScope,
): Effect.Effect<
	void,
	ApiError,
	HttpServerRequest.HttpServerRequest | PlatformDb
> =>
	Effect.gen(function* () {
		if (needed === "read") return;
		const request = yield* HttpServerRequest.HttpServerRequest;

		const header = request.headers.authorization as string | undefined;
		if (!header?.startsWith("Bearer ")) return;

		const db = yield* PlatformDb;
		const key = db
			.prepare("SELECT scope FROM api_keys WHERE key_hash = ?")
			.get(sha256(header.slice(7))) as { scope: ApiKeyScope } | null;

		// An unknown key is resolveApiUser's 401 to give, not ours. Saying nothing
		// here keeps one answer for one question.
		if (!key) return;

		if (key.scope !== "write") {
			return yield* Effect.fail(
				new ApiError({ status: 403, message: SCOPE_REFUSAL }),
			);
		}
	});
