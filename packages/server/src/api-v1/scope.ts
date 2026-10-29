/**
 * What an API key is allowed to do.
 *
 * A key used to authenticate as its owner and carry every right that user had,
 * so one handed to a CI job could delete a workspace as readily as list pages.
 * Two scopes fix that: `read` may only read, `write` may do anything its owner
 * can. See ADR-008 for why this is the one axis that does not reduce to a
 * relation, and NOT-124 for why it is two values rather than six.
 *
 * ONE RULE, ASKED BY EVERY DOOR. `allows` is the only place that decides
 * whether a credential may run something: the REST door asks it for each
 * typed operation, the MCP door when it lists and calls tools, and the admin
 * routes in index.ts before their policies. A door that asked its own version
 * of the question is precisely the shape of NOT-102, where one handler never
 * wrote the check its neighbours had.
 *
 * The scope a request needs is what its operation declares (NOT-169), never
 * what its HTTP method suggests: MCP has no method, and both doors must agree.
 */

import { Effect } from "effect";
import { ApiError } from "./auth.js";

export type ApiKeyScope = "read" | "write";

/** The refusal, worded so the holder knows what to do about it. */
export const SCOPE_REFUSAL =
	"This API key is read-only. Create a key with write scope to make changes.";

/**
 * May a credential holding `held` run something that needs `needed`?
 *
 * `held` is undefined for a cookie session, which is unscoped by construction:
 * it is the user themselves, and whatever they may do through the UI they may
 * do here. It answers "may this credential mutate", not "who is this":
 * resolving the caller stays in resolveApiKey, where ADR-008 put it.
 */
export const allows = (
	held: ApiKeyScope | undefined,
	needed: ApiKeyScope,
): boolean => needed === "read" || held !== "read";

/** `allows`, as the REST door's 403. */
export const enforceScope = (
	held: ApiKeyScope | undefined,
	needed: ApiKeyScope,
): Effect.Effect<void, ApiError> =>
	allows(held, needed)
		? Effect.void
		: Effect.fail(new ApiError({ status: 403, message: SCOPE_REFUSAL }));
