import { Effect } from "effect";
import { ulid } from "ulidx";
import { Workspace, WorkspaceMember } from "@notion-alt/shared";
import { PlatformDb } from "../platform-db.js";

type WorkspaceRow = {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  invite_token: string;
};

type MemberRow = {
  workspace_id: string;
  user_id: string;
  role: string;
};

const toWorkspace = (row: WorkspaceRow, role: "owner" | "member"): Workspace =>
  new Workspace({
    id: row.id,
    name: row.name,
    slug: row.slug,
    role,
    inviteToken: role === "owner" ? row.invite_token : null,
  });

export const createWorkspace = (req: { userId: string; name: string; slug: string }) =>
  Effect.gen(function* () {
    const db = yield* PlatformDb;
    const id = ulid();
    const inviteToken = ulid();
    const now = new Date().toISOString();

    try {
      db.prepare(
        "INSERT INTO workspaces (id, name, slug, owner_id, invite_token, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      ).run(id, req.name, req.slug, req.userId, inviteToken, now);
    } catch (e: any) {
      return yield* Effect.fail(new Error(e.message));
    }

    db.prepare(
      "INSERT INTO workspace_members (workspace_id, user_id, role, joined_at) VALUES (?, ?, 'owner', ?)",
    ).run(id, req.userId, now);

    return toWorkspace(
      { id, name: req.name, slug: req.slug, owner_id: req.userId, invite_token: inviteToken },
      "owner",
    );
  });

export const getMyWorkspaces = (userId: string) =>
  Effect.gen(function* () {
    const db = yield* PlatformDb;
    const rows = db
      .prepare(
        `SELECT w.*, wm.role FROM workspaces w
         JOIN workspace_members wm ON wm.workspace_id = w.id
         WHERE wm.user_id = ?
         ORDER BY w.created_at ASC`,
      )
      .all(userId) as (WorkspaceRow & { role: string })[];

    return rows.map((row) => toWorkspace(row, row.role as "owner" | "member"));
  });

export const joinWorkspaceByToken = (req: { userId: string; inviteToken: string }) =>
  Effect.gen(function* () {
    const db = yield* PlatformDb;

    const ws = db
      .prepare("SELECT * FROM workspaces WHERE invite_token = ?")
      .get(req.inviteToken) as WorkspaceRow | null;

    if (!ws) {
      return yield* Effect.fail(new Error("Invalid invite token"));
    }

    const existing = db
      .prepare("SELECT 1 FROM workspace_members WHERE workspace_id = ? AND user_id = ?")
      .get(ws.id, req.userId);

    if (!existing) {
      db.prepare(
        "INSERT INTO workspace_members (workspace_id, user_id, role, joined_at) VALUES (?, ?, 'member', ?)",
      ).run(ws.id, req.userId, new Date().toISOString());
    }

    return toWorkspace(ws, "member");
  });

export const getWorkspaceMembers = (workspaceId: string) =>
  Effect.gen(function* () {
    const db = yield* PlatformDb;
    const rows = db
      .prepare(
        `SELECT wm.user_id, wm.role,
                COALESCE(u.name, '') as name,
                COALESCE(u.email, '') as email
         FROM workspace_members wm
         LEFT JOIN "user" u ON u.id = wm.user_id
         WHERE wm.workspace_id = ?`,
      )
      .all(workspaceId) as { user_id: string; role: string; name: string; email: string }[];

    return rows.map(
      (r) =>
        new WorkspaceMember({
          userId: r.user_id,
          name: r.name,
          email: r.email,
          role: r.role as "owner" | "member",
        }),
    );
  });

export const removeMember = (req: { workspaceId: string; userId: string }) =>
  Effect.gen(function* () {
    const db = yield* PlatformDb;

    const ws = db
      .prepare("SELECT owner_id FROM workspaces WHERE id = ?")
      .get(req.workspaceId) as { owner_id: string } | null;

    if (ws?.owner_id === req.userId) {
      return yield* Effect.fail(new Error("Cannot remove the workspace owner"));
    }

    db.prepare(
      "DELETE FROM workspace_members WHERE workspace_id = ? AND user_id = ?",
    ).run(req.workspaceId, req.userId);
  });

export const regenerateInviteLink = (workspaceId: string) =>
  Effect.gen(function* () {
    const db = yield* PlatformDb;
    const newToken = ulid();
    db.prepare("UPDATE workspaces SET invite_token = ? WHERE id = ?").run(newToken, workspaceId);
    return { inviteToken: newToken };
  });
