/**
 * Who belongs to a workspace, and in what capacity.
 *
 * This is the only place in the server that asks. Before it, the same
 * membership query appeared character-identical in five modules
 * (`workspace-context.ts` three times, `handlers/permissions.ts` twice,
 * `api-v1/auth.ts` once), which is how NOT-102 happened: a handler that simply
 * never wrote the sixth copy.
 *
 * Membership is expressed as a **relation** — `owner` implies `member` — so the
 * rest of the authorization code speaks one vocabulary whether it is asking
 * about a workspace or a page. Storage stays in `workspace_members` on the
 * platform database rather than becoming relation tuples: deduplicating the
 * five copies is what mattered, and it is achieved here without a data
 * migration on the auth path. See NOT-104's notes for the full reasoning.
 *
 * KNOWN GAP, recorded rather than hidden: page ACLs address workspace members
 * through the `workspace:<id>#member` subject, and `acl.ts` matches that subject
 * by string comparison rather than resolving it through this module. The two
 * agree today because a page ACL is only ever evaluated after membership has
 * been established. They would stop agreeing the moment membership gains
 * structure — nested teamspaces, guest relations. That is the trigger to
 * revisit, not a date.
 */
import { Effect } from "effect";
import { PlatformDb } from "./platform-db.js";

/**
 * A caller's standing in a workspace. `owner` implies `member`; ask with
 * `isOwner` / `isMember` rather than comparing the string at call sites.
 */
export type WorkspaceRole = "owner" | "member";

/** The caller's role in this workspace, or null if they do not belong to it. */
export const roleOf = (
	userId: string,
	workspaceId: string,
): Effect.Effect<WorkspaceRole | null, never, PlatformDb> =>
	Effect.gen(function* () {
		const db = yield* PlatformDb;
		const row = db
			.prepare(
				"SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?",
			)
			.get(workspaceId, userId) as { role: WorkspaceRole } | null;
		return row?.role ?? null;
	});

/** Does the caller belong to this workspace at all? */
export const isMember = (
	userId: string,
	workspaceId: string,
): Effect.Effect<boolean, never, PlatformDb> =>
	roleOf(userId, workspaceId).pipe(Effect.map((role) => role !== null));

/** Does the caller own this workspace? */
export const isOwner = (
	userId: string,
	workspaceId: string,
): Effect.Effect<boolean, never, PlatformDb> =>
	roleOf(userId, workspaceId).pipe(Effect.map((role) => role === "owner"));

/**
 * Every workspace the caller belongs to.
 *
 * One platform query by construction — this must never fan out across
 * per-workspace databases, which is the constraint that kept membership in the
 * platform store.
 */
export const workspacesOf = (
	userId: string,
): Effect.Effect<readonly string[], never, PlatformDb> =>
	Effect.gen(function* () {
		const db = yield* PlatformDb;
		const rows = db
			.prepare("SELECT workspace_id FROM workspace_members WHERE user_id = ?")
			.all(userId) as Array<{ workspace_id: string }>;
		return rows.map((r) => r.workspace_id);
	});
