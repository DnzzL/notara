import type { Database } from "bun:sqlite";
import { deleteWorkspaceDb } from "./db.js";
import { platformDb } from "./platform-db.js";

/**
 * Hosted-demo mode. Off unless explicitly switched on, because it turns on
 * anonymous sign-in: a self-hosted install must never get it by accident.
 */
export const demoMode = () => process.env.DEMO_MODE === "true";

/** How long a demo workspace survives before the purge reclaims it. */
export const demoTtlHours = () => Number(process.env.DEMO_TTL_HOURS ?? 24);

/**
 * Remove demo workspaces older than `ttlHours`: member rows, the workspace row,
 * the SQLite file (via the injected `deleteDb`), and the owning anonymous user
 * once it owns nothing else. Only `is_demo = 1` rows are ever considered.
 *
 * The SQLite FK pragma is OFF in this codebase, so every child row is deleted
 * explicitly — nothing cascades.
 */
export const purgeExpiredDemos = (opts: {
	db: Database;
	ttlHours: number;
	deleteDb: (workspaceId: string) => void;
}): { workspaces: string[]; users: string[] } => {
	const { db, ttlHours, deleteDb } = opts;
	const cutoff = new Date(Date.now() - ttlHours * 60 * 60 * 1000).toISOString();

	// datetime() normalises both the ISO strings written by createWorkspace and
	// the "YYYY-MM-DD HH:MM:SS" form of the column default.
	const expired = db
		.prepare(
			"SELECT id, owner_id FROM workspaces WHERE is_demo = 1 AND datetime(created_at) < datetime(?)",
		)
		.all(cutoff) as { id: string; owner_id: string }[];

	const users: string[] = [];
	for (const ws of expired) {
		db.prepare("DELETE FROM workspace_members WHERE workspace_id = ?").run(
			ws.id,
		);
		db.prepare("DELETE FROM workspaces WHERE id = ?").run(ws.id);
		deleteDb(ws.id);

		const anonymousOwner = db
			.prepare('SELECT 1 FROM "user" WHERE id = ? AND "isAnonymous" = 1')
			.get(ws.owner_id);
		if (!anonymousOwner) continue;

		const { n } = db
			.prepare("SELECT COUNT(*) AS n FROM workspaces WHERE owner_id = ?")
			.get(ws.owner_id) as { n: number };
		if (n > 0) continue;

		db.prepare("DELETE FROM workspace_members WHERE user_id = ?").run(
			ws.owner_id,
		);
		db.prepare('DELETE FROM session WHERE "userId" = ?').run(ws.owner_id);
		db.prepare('DELETE FROM account WHERE "userId" = ?').run(ws.owner_id);
		db.prepare('DELETE FROM "user" WHERE id = ?').run(ws.owner_id);
		users.push(ws.owner_id);
	}

	return { workspaces: expired.map((w) => w.id), users };
};

/** Start the demo purge. Runs once immediately, then hourly. */
export function startDemoPurge() {
	const tick = () => {
		try {
			const ttlHours = demoTtlHours();
			const res = purgeExpiredDemos({
				db: platformDb,
				ttlHours,
				deleteDb: deleteWorkspaceDb,
			});
			if (res.workspaces.length) {
				console.log(
					`[demo-purge] removed ${res.workspaces.length} expired demo workspace(s) and ${res.users.length} anonymous user(s) (ttl ${ttlHours}h)`,
				);
			}
		} catch (e) {
			console.error("[demo-purge] failed:", e);
		}
	};
	setInterval(tick, 60 * 60 * 1000);
	tick();
}
