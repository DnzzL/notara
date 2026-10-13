import type { Database } from "bun:sqlite";

/**
 * A handle: lowercase letters, digits, `_` and `-`, 2 to 30 long, starting and
 * ending with a letter or digit (so `@bob-` in prose still names `@bob`).
 */
export const HANDLE = /^[a-z0-9][a-z0-9_-]{0,28}[a-z0-9]$/;

/** The handle a name suggests: its first word, lowercased, accents stripped. */
const baseHandle = (name: string) => {
	const word = name
		.normalize("NFD")
		.toLowerCase()
		.split(/\s+/)
		.map((w) => w.replace(/[^a-z0-9]/g, ""))
		.find((w) => w.length > 0);
	return word && word.length >= 2 ? word.slice(0, 26) : "member";
};

/** A handle for `name` no other member of `workspaceId` holds. */
const freeHandle = (db: Database, workspaceId: string, name: string) => {
	const base = baseHandle(name);
	const taken = new Set(
		(
			db
				.prepare(
					"SELECT handle FROM workspace_members WHERE workspace_id = ? AND handle LIKE ?",
				)
				.all(workspaceId, `${base}%`) as { handle: string }[]
		).map((r) => r.handle),
	);
	if (!taken.has(base)) return base;
	let n = 2;
	while (taken.has(`${base}${n}`)) n++;
	return `${base}${n}`;
};

const nameOf = (db: Database, userId: string) =>
	(
		db.prepare(`SELECT name FROM "user" WHERE id = ?`).get(userId) as {
			name: string;
		} | null
	)?.name ?? "";

/** The members of `workspaceId` holding any of `handles` (lowercase). */
export const membersByHandle = (
	db: Database,
	workspaceId: string,
	handles: readonly string[],
) =>
	handles.length === 0
		? []
		: (
				db
					.prepare(
						`SELECT user_id FROM workspace_members
             WHERE workspace_id = ? AND handle IN (${handles.map(() => "?").join(",")})`,
					)
					.all(workspaceId, ...handles) as { user_id: string }[]
			).map((r) => r.user_id);

/** Make `userId` a member of `workspaceId`, with a handle of their own. */
export const addMember = (
	db: Database,
	workspaceId: string,
	userId: string,
	role: "owner" | "member",
	joinedAt: string,
) =>
	db
		.prepare(
			"INSERT INTO workspace_members (workspace_id, user_id, role, joined_at, handle) VALUES (?, ?, ?, ?, ?)",
		)
		.run(
			workspaceId,
			userId,
			role,
			joinedAt,
			freeHandle(db, workspaceId, nameOf(db, userId)),
		);

/** Give a handle to every member who has none, in the order they joined. */
export const backfillHandles = (db: Database) => {
	const missing = db
		.prepare(
			"SELECT workspace_id, user_id FROM workspace_members WHERE handle IS NULL ORDER BY joined_at, rowid",
		)
		.all() as { workspace_id: string; user_id: string }[];
	const set = db.prepare(
		"UPDATE workspace_members SET handle = ? WHERE workspace_id = ? AND user_id = ?",
	);
	for (const m of missing)
		set.run(
			freeHandle(db, m.workspace_id, nameOf(db, m.user_id)),
			m.workspace_id,
			m.user_id,
		);
};
