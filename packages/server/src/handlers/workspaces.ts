import {
	ConflictError,
	NotFoundError,
	ValidationError,
	Workspace,
	WorkspaceMember,
} from "@notara/shared";
import { Effect } from "effect";
import { ulid } from "ulidx";
import { demoMode } from "../demo.js";
import { BASE_URL, sendEmail } from "../email.js";
import * as Membership from "../membership.js";
import { PlatformDb } from "../platform-db.js";

type WorkspaceRow = {
	id: string;
	name: string;
	slug: string;
	owner_id: string;
	invite_token: string;
	is_demo: number;
};

const toWorkspace = (row: WorkspaceRow, role: "owner" | "member"): Workspace =>
	new Workspace({
		id: row.id,
		name: row.name,
		slug: row.slug,
		role,
		inviteToken: role === "owner" ? row.invite_token : null,
		isDemo: row.is_demo === 1,
	});

export const createWorkspace = (req: {
	userId: string;
	name: string;
	slug: string;
}) =>
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
			return yield* new ConflictError({ message: String(e.message) });
		}

		db.prepare(
			"INSERT INTO workspace_members (workspace_id, user_id, role, joined_at) VALUES (?, ?, 'owner', ?)",
		).run(id, req.userId, now);

		return toWorkspace(
			{
				id,
				name: req.name,
				slug: req.slug,
				owner_id: req.userId,
				invite_token: inviteToken,
				is_demo: 0,
			},
			"owner",
		);
	});

/**
 * Hosted-demo entry point: hand the (anonymous) caller a throwaway workspace
 * marked is_demo=1 so the demo purge can reclaim it later. Idempotent per user —
 * a second call returns the demo workspace the caller already owns instead of
 * piling up new ones.
 *
 * `created` tells the caller whether starter content still needs seeding.
 */
export const startDemo = (userId: string) =>
	Effect.gen(function* () {
		if (!demoMode()) {
			return yield* new ValidationError({
				message: "Demo mode is not enabled",
			});
		}
		const db = yield* PlatformDb;

		const existing = db
			.prepare(
				"SELECT * FROM workspaces WHERE owner_id = ? AND is_demo = 1 ORDER BY created_at ASC LIMIT 1",
			)
			.get(userId) as WorkspaceRow | null;
		if (existing) {
			return { workspace: toWorkspace(existing, "owner"), created: false };
		}

		const id = ulid();
		const inviteToken = ulid();
		const slug = `demo-${id.toLowerCase()}`;
		const now = new Date().toISOString();

		db.prepare(
			"INSERT INTO workspaces (id, name, slug, owner_id, invite_token, created_at, is_demo) VALUES (?, ?, ?, ?, ?, ?, 1)",
		).run(id, "Demo workspace", slug, userId, inviteToken, now);
		db.prepare(
			"INSERT INTO workspace_members (workspace_id, user_id, role, joined_at) VALUES (?, ?, 'owner', ?)",
		).run(id, userId, now);

		return {
			workspace: toWorkspace(
				{
					id,
					name: "Demo workspace",
					slug,
					owner_id: userId,
					invite_token: inviteToken,
					is_demo: 1,
				},
				"owner",
			),
			created: true,
		};
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

export const joinWorkspaceByToken = (req: {
	userId: string;
	inviteToken: string;
}) =>
	Effect.gen(function* () {
		const db = yield* PlatformDb;

		const ws = db
			.prepare("SELECT * FROM workspaces WHERE invite_token = ?")
			.get(req.inviteToken) as WorkspaceRow | null;

		if (!ws) {
			return yield* new ValidationError({ message: "Invalid invite token" });
		}

		const alreadyIn = yield* Membership.isMember(req.userId, ws.id);

		if (!alreadyIn) {
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
			.all(workspaceId) as {
			user_id: string;
			role: string;
			name: string;
			email: string;
		}[];

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
			return yield* new ConflictError({
				message: "Cannot remove the workspace owner",
			});
		}

		db.prepare(
			"DELETE FROM workspace_members WHERE workspace_id = ? AND user_id = ?",
		).run(req.workspaceId, req.userId);
	});

export const regenerateInviteLink = (workspaceId: string) =>
	Effect.gen(function* () {
		const db = yield* PlatformDb;
		const newToken = ulid();
		db.prepare("UPDATE workspaces SET invite_token = ? WHERE id = ?").run(
			newToken,
			workspaceId,
		);
		return { inviteToken: newToken };
	});

export const inviteMemberByEmail = (req: {
	workspaceId: string;
	email: string;
}) =>
	Effect.gen(function* () {
		const db = yield* PlatformDb;
		const ws = db
			.prepare("SELECT * FROM workspaces WHERE id = ?")
			.get(req.workspaceId) as WorkspaceRow | null;

		if (!ws)
			return yield* new NotFoundError({
				resource: "workspace",
				id: req.workspaceId,
			});

		const joinUrl = `${BASE_URL}/join/${ws.invite_token}`;
		yield* Effect.promise(() =>
			sendEmail(
				req.email,
				`You're invited to join "${ws.name}" on Notara`,
				`<p>You've been invited to collaborate on <strong>${ws.name}</strong>.</p>
<p><a href="${joinUrl}" style="background:#5B5EF4;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;">Accept invitation</a></p>
<p>Or copy this link: <a href="${joinUrl}">${joinUrl}</a></p>
<p>— The Notara team</p>`,
			),
		);
	});
