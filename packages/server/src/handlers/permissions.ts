import {
	AclEntry,
	type ApiError,
	AuthError,
	ConflictError,
	decodeSubject,
	encodeSubject,
	NotFoundError,
	type NotFoundResource,
	PagePermissions,
	type Subject,
} from "@notara/shared";
import { Effect } from "effect";
import { SqlClient } from "effect/unstable/sql";
import * as Acl from "../acl.js";
import * as Membership from "../membership.js";
import type { PlatformDb } from "../platform-db.js";
import * as Blocks from "./blocks.js";

export type AclRelation = Acl.Relation;

export type PermissionsDeps = SqlClient.SqlClient | PlatformDb;

/** Relation inclusion, declared in acl.ts rather than as a rank comparison. */
const satisfies = Acl.implies;

/** Subjects (encoded) that should match `userId` within `workspaceId`. */
const userSubjectStrings = (userId: string, workspaceId: string): string[] => [
	`user:${userId}`,
	`workspace:${workspaceId}#member`,
	"public",
];

/**
 * The relation a user effectively holds on a page, or null if they hold none.
 *
 * Membership comes from `membership.ts`, resolution from `acl.ts` — the rule
 * order, and the fact that a lock refuses authoritatively rather than falling
 * through, are declared there. See ADR-007.
 */
export const resolveEffectiveRelation = (
	userId: string,
	workspaceId: string,
	pageId: string,
): Effect.Effect<AclRelation | null, never, PermissionsDeps> =>
	Effect.gen(function* () {
		const workspaceRole = yield* Membership.roleOf(userId, workspaceId);

		// Resolution itself lives in acl.ts, where the rule order and the
		// authoritative-deny case are stated rather than implied by control flow.
		return yield* Acl.effectiveRelation(
			{ userId, workspaceId, workspaceRole },
			pageId,
		);
	});

/**
 * Checks that `userId` has at least `requiredRelation` on `pageId` within
 * `workspaceId`. Fails with AuthError(403) if access is denied.
 */
export const checkPagePermission = (
	userId: string,
	workspaceId: string,
	pageId: string,
	requiredRelation: AclRelation,
): Effect.Effect<void, ApiError, PermissionsDeps> =>
	Effect.gen(function* () {
		const effective = yield* resolveEffectiveRelation(
			userId,
			workspaceId,
			pageId,
		);
		if (effective === null) {
			const isMember = yield* Membership.isMember(userId, workspaceId);
			return yield* new AuthError({
				status: 403,
				message: isMember
					? "Insufficient permission"
					: "Not a member of this workspace",
			});
		}
		if (!satisfies(effective, requiredRelation)) {
			return yield* new AuthError({
				status: 403,
				message: "Insufficient permission",
			});
		}
	});

/** Non-throwing variant for UI gating. */
export const canAccessPage = (
	userId: string,
	workspaceId: string,
	pageId: string,
	requiredRelation: AclRelation,
): Effect.Effect<boolean, never, PermissionsDeps> =>
	resolveEffectiveRelation(userId, workspaceId, pageId).pipe(
		Effect.map((rel) => rel !== null && satisfies(rel, requiredRelation)),
	);

/**
 * Filters a list of pages to only those visible to `userId`.
 * Workspace owners see everything. For members, pages with a locked ancestor
 * are only visible if the user has an ACL entry on that ancestor.
 * Uses 2 SQL queries regardless of page count.
 */
export const filterPagesByPermission = <
	P extends { id: string; parentId: string | null },
>(
	userId: string,
	workspaceId: string,
	workspaceRole: "owner" | "member",
	allPages: readonly P[],
) =>
	Effect.gen(function* () {
		if (workspaceRole === "owner") return [...allPages];

		const sql = yield* SqlClient.SqlClient;

		const lockedRows = yield* sql.unsafe(
			`SELECT DISTINCT resource_id FROM acl_tuples WHERE resource_type = 'page'`,
		);
		const lockedIds = new Set<string>(
			(lockedRows as unknown as { resource_id: string }[]).map(
				(r) => r.resource_id,
			),
		);

		if (lockedIds.size === 0) return [...allPages];

		const subjects = userSubjectStrings(userId, workspaceId);
		const placeholders = subjects.map(() => "?").join(", ");
		const accessRows = yield* sql.unsafe(
			`SELECT DISTINCT resource_id FROM acl_tuples
       WHERE resource_type = 'page' AND subject IN (${placeholders})`,
			subjects,
		);
		const accessibleIds = new Set<string>(
			(accessRows as unknown as { resource_id: string }[]).map(
				(r) => r.resource_id,
			),
		);

		const parentMap = new Map<string, string | null>(
			allPages.map((p) => [p.id, p.parentId]),
		);

		return allPages.filter((page) => {
			let current: string | null = page.id;
			while (current !== null) {
				if (lockedIds.has(current)) return accessibleIds.has(current);
				current = parentMap.get(current) ?? null;
			}
			return true;
		});
	});

/** Fails with AuthError(403) if the caller is not a workspace owner. */
export const requireWorkspaceOwner = (userId: string, workspaceId: string) =>
	Effect.gen(function* () {
		const role = yield* Membership.roleOf(userId, workspaceId);
		if (role === null) {
			return yield* new AuthError({
				status: 403,
				message: "Not a member of this workspace",
			});
		}
		if (role !== "owner") {
			return yield* new AuthError({
				status: 403,
				message: "Workspace owner role required",
			});
		}
	});

/**
 * Returns the IDs of pages with explicit ACL entries that the caller can
 * actually see. Filters out locked pages the caller is excluded from to avoid
 * leaking the existence of restricted resources. Workspace owners see all
 * locked IDs.
 */
export const listVisibleLockedPageIds = (
	userId: string,
	workspaceId: string,
	workspaceRole: "owner" | "member",
) =>
	Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;
		const lockedRows = yield* sql.unsafe(
			`SELECT DISTINCT resource_id FROM acl_tuples WHERE resource_type = 'page'`,
		);
		const lockedIds = (lockedRows as unknown as { resource_id: string }[]).map(
			(r) => r.resource_id,
		);
		if (workspaceRole === "owner" || lockedIds.length === 0) return lockedIds;

		const subjects = userSubjectStrings(userId, workspaceId);
		const placeholders = subjects.map(() => "?").join(", ");
		const accessRows = yield* sql.unsafe(
			`SELECT DISTINCT resource_id FROM acl_tuples
       WHERE resource_type = 'page' AND subject IN (${placeholders})`,
			subjects,
		);
		const accessibleIds = new Set<string>(
			(accessRows as unknown as { resource_id: string }[]).map(
				(r) => r.resource_id,
			),
		);

		// A locked page is "visible" to the caller iff they have a direct grant on
		// it. Inherited access to children of a locked page doesn't entitle them
		// to learn the lock exists, so we don't expand here.
		return lockedIds.filter((id) => accessibleIds.has(id));
	});

// A block's owning page is looked up by the blocks module, which owns blocks.
// This file had a second, identical implementation of it.
export { getBlockPageId } from "./blocks.js";

/** Resolves the page_id that owns a given database. Returns null if not found. */
export const getDatabasePageId = (databaseId: string) =>
	Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;
		const rows = yield* sql.unsafe(
			`SELECT page_id FROM databases WHERE id = ?`,
			[databaseId],
		);
		const list = rows as unknown as { page_id: string }[];
		return list.length > 0 ? list[0].page_id : null;
	});

/** Resolves the page_id that owns a given record (via its database). */
export const getRecordPageId = (recordId: string) =>
	Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;
		const rows = yield* sql.unsafe(
			`SELECT d.page_id FROM database_records r JOIN databases d ON d.id = r.database_id WHERE r.id = ?`,
			[recordId],
		);
		const list = rows as unknown as { page_id: string }[];
		return list.length > 0 ? list[0].page_id : null;
	});

/** Resolves the page_id that owns a given field (via its database). */
export const getFieldPageId = (fieldId: string) =>
	Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;
		const rows = yield* sql.unsafe(
			`SELECT d.page_id FROM database_fields f JOIN databases d ON d.id = f.database_id WHERE f.id = ?`,
			[fieldId],
		);
		const list = rows as unknown as { page_id: string }[];
		return list.length > 0 ? list[0].page_id : null;
	});

/** Resolves the page_id that owns a given database view (via its database). */
export const getViewPageId = (viewId: string) =>
	Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;
		const rows = yield* sql.unsafe(
			`SELECT d.page_id FROM database_views v JOIN databases d ON d.id = v.database_id WHERE v.id = ?`,
			[viewId],
		);
		const list = rows as unknown as { page_id: string }[];
		return list.length > 0 ? list[0].page_id : null;
	});

const checkVia =
	<E>(
		lookup: (
			id: string,
		) => Effect.Effect<string | null, E, SqlClient.SqlClient>,
		kind: NotFoundResource,
	) =>
	(
		userId: string,
		workspaceId: string,
		id: string,
		requiredRelation: AclRelation,
	) =>
		Effect.gen(function* () {
			const pageId = yield* lookup(id);
			if (!pageId) {
				return yield* new NotFoundError({ resource: kind, id });
			}
			yield* checkPagePermission(userId, workspaceId, pageId, requiredRelation);
		});

export const checkBlockPermission = checkVia(Blocks.getBlockPageId, "block");
export const checkDatabasePermission = checkVia(getDatabasePageId, "database");
export const checkRecordPermission = checkVia(getRecordPageId, "record");
export const checkFieldPermission = checkVia(getFieldPageId, "field");
export const checkViewPermission = checkVia(getViewPageId, "view");

// ── Page-ACL CRUD ─────────────────────────────────────────────────────────────

const decodeRows = (
	rows: { relation: string; subject: string }[],
): AclEntry[] => {
	const out: AclEntry[] = [];
	for (const r of rows) {
		const subject = decodeSubject(r.subject);
		if (subject)
			out.push(new AclEntry({ relation: r.relation as AclRelation, subject }));
	}
	return out;
};

/** Direct ACL entries on a page (no ancestor walk). */
export const listPageAcl = (pageId: string) =>
	Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;
		const rows = yield* sql.unsafe(
			`SELECT relation, subject FROM acl_tuples WHERE resource_type = 'page' AND resource_id = ?`,
			[pageId],
		);
		return decodeRows(
			rows as unknown as { relation: string; subject: string }[],
		);
	});

/** Resolves the nearest locked ancestor of `pageId` (or `pageId` itself).
 *  Returns null if no ancestor is locked. */
export const findLockedAncestor = (pageId: string) =>
	Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;
		let currentId: string | null = pageId;
		while (currentId !== null) {
			const rows = (yield* sql.unsafe(
				`SELECT 1 AS hit FROM acl_tuples WHERE resource_type = 'page' AND resource_id = ? LIMIT 1`,
				[currentId],
			)) as unknown as { hit: number }[];
			if (rows.length > 0) return currentId;
			const parentRows = (yield* sql.unsafe(
				`SELECT parent_id FROM pages WHERE id = ?`,
				[currentId],
			)) as unknown as { parent_id: string | null }[];
			currentId =
				parentRows.length > 0 ? (parentRows[0].parent_id ?? null) : null;
		}
		return null;
	});

const readRevision = (pageId: string) =>
	Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;
		const rows = (yield* sql.unsafe(
			`SELECT revision FROM acl_revisions WHERE resource_type = 'page' AND resource_id = ?`,
			[pageId],
		)) as unknown as { revision: number }[];
		return rows.length > 0 ? String(rows[0].revision) : "0";
	});

/**
 * Read direct + inherited grants for a page along with the page's current ACL
 * revision token. Inherited grants come from the nearest locked ancestor (if
 * any) and are advisory only — they reflect what governs access today.
 */
export const getPagePermissions = (pageId: string) =>
	Effect.gen(function* () {
		const direct = yield* listPageAcl(pageId);
		let inheritedFromPageId: string | null = null;
		let inherited: AclEntry[] = [];
		if (direct.length === 0) {
			const sql = yield* SqlClient.SqlClient;
			const parentRows = (yield* sql.unsafe(
				`SELECT parent_id FROM pages WHERE id = ?`,
				[pageId],
			)) as unknown as { parent_id: string | null }[];
			const parentId =
				parentRows.length > 0 ? (parentRows[0].parent_id ?? null) : null;
			if (parentId) {
				inheritedFromPageId = yield* findLockedAncestor(parentId);
				if (inheritedFromPageId) {
					inherited = yield* listPageAcl(inheritedFromPageId);
				}
			}
		}
		const revision = yield* readRevision(pageId);
		return new PagePermissions({
			direct,
			inheritedFromPageId,
			inherited,
			revision,
		});
	});

const bumpRevision = (pageId: string) =>
	Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;
		yield* sql.unsafe(
			`INSERT INTO acl_revisions (resource_type, resource_id, revision)
       VALUES ('page', ?, 1)
       ON CONFLICT (resource_type, resource_id)
       DO UPDATE SET revision = revision + 1`,
			[pageId],
		);
		return yield* readRevision(pageId);
	});

/**
 * Atomic batched ACL write. Applies all `set` upserts and all `remove`s in a
 * single transaction. Enforces:
 *   - `ifRevision` matches current page revision (optimistic concurrency)
 *   - the page retains at least one explicit `owner` grant after the write,
 *     unless the page becomes fully open (no entries at all)
 *
 * Returns the new revision token.
 */
export const writePagePermissions = (input: {
	pageId: string;
	set: ReadonlyArray<{ subject: Subject; relation: AclRelation }>;
	remove: ReadonlyArray<{ subject: Subject }>;
	ifRevision?: string;
	/** When set to "owner", skips the "must keep at least one explicit owner"
	 *  guard because workspace owners retain implicit owner access through
	 *  their workspace role and can never get locked out. */
	callerWorkspaceRole?: "owner" | "member";
}) =>
	Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;
		const { pageId } = input;

		return yield* sql
			.withTransaction(
				Effect.gen(function* () {
					if (input.ifRevision !== undefined) {
						const current = yield* readRevision(pageId);
						if (current !== input.ifRevision) {
							return yield* new ConflictError({
								message: `Page permissions changed since revision ${input.ifRevision} (current: ${current})`,
							});
						}
					}

					for (const r of input.remove) {
						yield* sql.unsafe(
							`DELETE FROM acl_tuples WHERE resource_type = 'page' AND resource_id = ? AND subject = ?`,
							[pageId, encodeSubject(r.subject)],
						);
					}
					for (const s of input.set) {
						yield* sql.unsafe(
							`INSERT INTO acl_tuples (resource_type, resource_id, subject, relation)
             VALUES ('page', ?, ?, ?)
             ON CONFLICT (resource_type, resource_id, subject)
             DO UPDATE SET relation = excluded.relation`,
							[pageId, encodeSubject(s.subject), s.relation],
						);
					}

					// Post-condition: if any entries remain, at least one must be `owner`.
					// (Fully clearing the ACL is allowed — the page falls back to
					// workspace-default access, which is the documented unlock semantics.)
					//
					// Workspace owners are exempt: they have implicit owner access via
					// their workspace role (see resolveEffectiveRelation), so they can
					// never be locked out even without an explicit ACL entry.
					const remaining = (yield* sql.unsafe(
						`SELECT relation FROM acl_tuples WHERE resource_type = 'page' AND resource_id = ?`,
						[pageId],
					)) as unknown as { relation: string }[];
					if (
						remaining.length > 0 &&
						!remaining.some((r) => r.relation === "owner") &&
						input.callerWorkspaceRole !== "owner"
					) {
						return yield* new ConflictError({
							message: "Refusing to leave page without any owner grant",
						});
					}

					const revision = yield* bumpRevision(pageId);
					return { revision };
				}),
			)
			.pipe(
				// Surface SqlError as die; ConflictError surfaces normally.
				Effect.catchTag("SqlError", (e) => Effect.die(e)),
			);
	});
