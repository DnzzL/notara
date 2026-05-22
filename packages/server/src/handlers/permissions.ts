import { Effect } from "effect";
import { SqlClient } from "@effect/sql";
import { PlatformDb } from "../platform-db.js";
import { ApiError } from "../api-v1/auth.js";

export type AclRelation = "owner" | "editor" | "viewer";

export type PermissionsDeps = SqlClient.SqlClient | PlatformDb;

const RANK: Record<AclRelation, number> = { owner: 3, editor: 2, viewer: 1 };

const satisfies = (effective: AclRelation, required: AclRelation) =>
  RANK[effective] >= RANK[required];

const workspaceRoleToRelation = (role: "owner" | "member"): AclRelation =>
  role === "owner" ? "owner" : "editor";

/**
 * Checks that `userId` has at least `requiredRelation` on `pageId` within
 * `workspaceId`. Fails with ApiError(403) if access is denied.
 *
 * Resolution order:
 *   1. Non-members → deny
 *   2. Workspace owners → always allow
 *   3. Walk up the page tree; first page with acl_tuples entries is the
 *      "effective ACL owner" — check user's entry there
 *   4. No locked ancestor → fall back to workspace member role (editor)
 */
export const checkPagePermission = (
  userId: string,
  workspaceId: string,
  pageId: string,
  requiredRelation: AclRelation,
): Effect.Effect<void, ApiError, PermissionsDeps> =>
  Effect.gen(function* () {
    const db = yield* PlatformDb;
    const sql = yield* SqlClient.SqlClient;

    const member = db
      .prepare("SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?")
      .get(workspaceId, userId) as { role: "owner" | "member" } | null;

    if (!member) {
      return yield* Effect.fail(
        new ApiError({ status: 403, message: "Not a member of this workspace" }),
      );
    }

    if (member.role === "owner") return;

    let currentId: string | null = pageId;
    while (currentId !== null) {
      const rows: ReadonlyArray<{ relation: string; subject: string }> = yield* sql
        .unsafe(
          `SELECT relation, subject FROM acl_tuples WHERE resource_type = 'page' AND resource_id = ?`,
          [currentId],
        )
        .pipe(Effect.orDie) as Effect.Effect<
          ReadonlyArray<{ relation: string; subject: string }>,
          never,
          never
        >;

      if (rows.length > 0) {
        const userSubjects = [`user:${userId}`, `workspace:${workspaceId}#member`];
        const userRows = rows.filter((r) => userSubjects.includes(r.subject));

        const best = userRows.reduce<AclRelation | null>((acc, r) => {
          const rel = r.relation as AclRelation;
          return !acc || RANK[rel] > RANK[acc] ? rel : acc;
        }, null);

        if (!best || !satisfies(best, requiredRelation)) {
          return yield* Effect.fail(
            new ApiError({ status: 403, message: "Insufficient permission" }),
          );
        }
        return;
      }

      const parentRows: ReadonlyArray<{ parent_id: string | null }> = yield* sql
        .unsafe(`SELECT parent_id FROM pages WHERE id = ?`, [currentId])
        .pipe(Effect.orDie) as Effect.Effect<
          ReadonlyArray<{ parent_id: string | null }>,
          never,
          never
        >;
      currentId = parentRows.length > 0 ? (parentRows[0].parent_id ?? null) : null;
    }

    const wsRelation = workspaceRoleToRelation(member.role);
    if (!satisfies(wsRelation, requiredRelation)) {
      return yield* Effect.fail(
        new ApiError({ status: 403, message: "Insufficient permission" }),
      );
    }
  });

/**
 * Filters a list of pages to only those visible to `userId`.
 * Workspace owners see everything. For members, pages with a locked ancestor
 * are only visible if the user has an ACL entry on that ancestor.
 * Uses 2 SQL queries regardless of page count.
 */
export const filterPagesByPermission = <P extends { id: string; parentId: string | null }>(
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
      (lockedRows as unknown as { resource_id: string }[]).map((r) => r.resource_id),
    );

    if (lockedIds.size === 0) return [...allPages];

    const userSubjects = [`user:${userId}`, `workspace:${workspaceId}#member`];
    const placeholders = userSubjects.map(() => "?").join(", ");
    const accessRows = yield* sql.unsafe(
      `SELECT DISTINCT resource_id FROM acl_tuples
       WHERE resource_type = 'page' AND subject IN (${placeholders})`,
      userSubjects,
    );
    const accessibleIds = new Set<string>(
      (accessRows as unknown as { resource_id: string }[]).map((r) => r.resource_id),
    );

    const parentMap = new Map<string, string | null>(allPages.map((p) => [p.id, p.parentId]));

    return allPages.filter((page) => {
      let current: string | null = page.id;
      while (current !== null) {
        if (lockedIds.has(current)) return accessibleIds.has(current);
        current = parentMap.get(current) ?? null;
      }
      return true;
    });
  });

export const setPageAcl = (pageId: string, subject: string, relation: AclRelation) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql.unsafe(
      `INSERT OR REPLACE INTO acl_tuples (resource_type, resource_id, relation, subject)
       VALUES ('page', ?, ?, ?)`,
      [pageId, relation, subject],
    );
  });

export const removePageAcl = (pageId: string, subject: string, relation: AclRelation) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql.unsafe(
      `DELETE FROM acl_tuples WHERE resource_type = 'page' AND resource_id = ? AND relation = ? AND subject = ?`,
      [pageId, relation, subject],
    );
  });

/** Resolves the page_id that owns a given block. Returns null if not found. */
export const getBlockPageId = (blockId: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const rows = yield* sql.unsafe(`SELECT page_id FROM blocks WHERE id = ?`, [blockId]);
    const list = rows as unknown as { page_id: string }[];
    return list.length > 0 ? list[0].page_id : null;
  });

/** Checks page permission for the page that owns the given block. */
export const checkBlockPermission = (
  userId: string,
  workspaceId: string,
  blockId: string,
  requiredRelation: AclRelation,
) =>
  Effect.gen(function* () {
    const pageId = yield* getBlockPageId(blockId);
    if (!pageId) {
      return yield* Effect.fail(new ApiError({ status: 404, message: `Block ${blockId} not found` }));
    }
    yield* checkPagePermission(userId, workspaceId, pageId, requiredRelation);
  });

export const listPageAcl = (pageId: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const rows = yield* sql.unsafe(
      `SELECT relation, subject FROM acl_tuples WHERE resource_type = 'page' AND resource_id = ?`,
      [pageId],
    );
    return (rows as unknown as { relation: string; subject: string }[]).map((r) => ({
      relation: r.relation as AclRelation,
      subject: r.subject,
    }));
  });
