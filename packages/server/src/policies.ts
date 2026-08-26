/**
 * The policies this application actually has.
 *
 * `policy.ts` is the mechanism; this is the vocabulary. Every entry reads the
 * caller from `CurrentUser` and answers against stored relations, so the same
 * decision is available to an RPC method, a REST route, an SSE stream and a
 * test without any of them restating the sequence of checks.
 *
 * Relation policies delegate to `handlers/permissions.ts`, which was already
 * the right shape — deep, with its own refusal reasons. The change is that they
 * no longer take a `userId` parameter threaded down from whichever surface
 * happened to resolve it.
 *
 * See ADR-008 for why there is no `domain:action` permission vocabulary here.
 */
import type { SqlClient } from "@effect/sql";
import { AuthError } from "@notara/shared";
import { Effect } from "effect";
import * as Permissions from "./handlers/permissions.js";
import * as Membership from "./membership.js";
import type { PlatformDb } from "./platform-db.js";
import { CurrentUser, fromCheck, type Policy, policy } from "./policy.js";

// ── Workspace ────────────────────────────────────────────────────────────────

/** The caller belongs to this workspace. */
export const workspaceMember = (
	workspaceId: string,
): Policy<never, PlatformDb> =>
	policy("Not a member of this workspace", (user) =>
		Membership.isMember(user.userId, workspaceId),
	);

/** The caller owns this workspace. Required for member management. */
export const workspaceOwner = (
	workspaceId: string,
): Policy<never, PlatformDb> =>
	policy("Workspace owner role required", (user) =>
		Membership.isOwner(user.userId, workspaceId),
	);

// ── Resources ────────────────────────────────────────────────────────────────

/**
 * The caller holds at least `relation` on this page.
 *
 * `fromCheck` rather than `policy` because the underlying check distinguishes
 * "not a member" from "insufficient permission", and flattening those into one
 * boolean would throw away the more useful of the two messages.
 */
export const page = (
	workspaceId: string,
	pageId: string,
	relation: Permissions.AclRelation,
): Policy<never, PlatformDb | SqlClient.SqlClient> =>
	fromCheck((user) =>
		Permissions.checkPagePermission(
			user.userId,
			workspaceId,
			pageId,
			relation,
		).pipe(
			// A missing page is a 404 from the handler's own lookup, not an
			// authorization answer; only auth failures belong in this channel.
			Effect.catchTag("NotFoundError", Effect.die),
			Effect.catchTag("ConflictError", Effect.die),
			Effect.catchTag("BlockLockedError", Effect.die),
			Effect.catchTag("ValidationError", Effect.die),
		),
	);

const via =
	(
		check: (
			userId: string,
			workspaceId: string,
			id: string,
			relation: Permissions.AclRelation,
		) => Effect.Effect<void, unknown, PlatformDb | SqlClient.SqlClient>,
	) =>
	(
		workspaceId: string,
		id: string,
		relation: Permissions.AclRelation,
	): Policy<never, PlatformDb | SqlClient.SqlClient> =>
		fromCheck((user) =>
			check(user.userId, workspaceId, id, relation).pipe(
				Effect.catchAll((error) =>
					error instanceof AuthError ? Effect.fail(error) : Effect.die(error),
				),
			),
		);

/** Each of these resolves its owning page, then asks the page policy. */
export const block = via(Permissions.checkBlockPermission);
export const database = via(Permissions.checkDatabasePermission);
export const record = via(Permissions.checkRecordPermission);
export const field = via(Permissions.checkFieldPermission);
export const view = via(Permissions.checkViewPermission);

// ── Instance ─────────────────────────────────────────────────────────────────

/**
 * The one axis that is not a relation to a resource: instance administration,
 * configured by `ADMIN_EMAILS` rather than stored as data (ADR-008).
 *
 * Read at call time, not at module load, so a test can set the variable without
 * having to control import order.
 *
 * An unconfigured admin list closes rather than opens. That is deliberate: the
 * failure mode of the opposite default is every deployment shipping with an
 * open admin panel.
 */
export const instanceAdmin: Policy = Effect.flatMap(CurrentUser, (user) => {
	const allowed = (process.env.ADMIN_EMAILS ?? "")
		.split(",")
		.map((entry) => entry.trim())
		.filter(Boolean);

	if (allowed.length === 0) {
		return Effect.fail(
			new AuthError({ status: 403, message: "Admin not configured" }),
		);
	}
	return allowed.includes(user.email)
		? Effect.void
		: Effect.fail(new AuthError({ status: 403, message: "Forbidden" }));
});
