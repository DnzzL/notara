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
      const rows = yield* sql.unsafe(
        `SELECT relation, subject FROM acl_tuples WHERE resource_type = 'page' AND resource_id = ?`,
        [currentId],
      );

      if (rows.length > 0) {
        const userSubjects = [`user:${userId}`, `workspace:${workspaceId}#member`];
        const userRows = (rows as { relation: string; subject: string }[]).filter((r) =>
          userSubjects.includes(r.subject),
        );

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

      const parentRows = yield* sql.unsafe(`SELECT parent_id FROM pages WHERE id = ?`, [
        currentId,
      ]);
      currentId =
        parentRows.length > 0
          ? ((parentRows[0] as { parent_id: string | null }).parent_id ?? null)
          : null;
    }

    const wsRelation = workspaceRoleToRelation(member.role);
    if (!satisfies(wsRelation, requiredRelation)) {
      return yield* Effect.fail(
        new ApiError({ status: 403, message: "Insufficient permission" }),
      );
    }
  });

export const setPageAcl = (
  pageId: string,
  subject: string,
  relation: AclRelation,
): Effect.Effect<void, never, SqlClient.SqlClient> =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql.unsafe(
      `INSERT OR REPLACE INTO acl_tuples (resource_type, resource_id, relation, subject)
       VALUES ('page', ?, ?, ?)`,
      [pageId, relation, subject],
    );
  });

export const removePageAcl = (
  pageId: string,
  subject: string,
  relation: AclRelation,
): Effect.Effect<void, never, SqlClient.SqlClient> =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql.unsafe(
      `DELETE FROM acl_tuples WHERE resource_type = 'page' AND resource_id = ? AND relation = ? AND subject = ?`,
      [pageId, relation, subject],
    );
  });

export const listPageAcl = (
  pageId: string,
): Effect.Effect<{ relation: AclRelation; subject: string }[], never, SqlClient.SqlClient> =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const rows = yield* sql.unsafe(
      `SELECT relation, subject FROM acl_tuples WHERE resource_type = 'page' AND resource_id = ?`,
      [pageId],
    );
    return (rows as { relation: string; subject: string }[]).map((r) => ({
      relation: r.relation as AclRelation,
      subject: r.subject,
    }));
  });
