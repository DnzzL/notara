import { Effect } from "effect";
import { WorkspaceDb, WorkspaceDbLive } from "./db.js";
import * as Databases from "./handlers/databases.js";
import { loadSettings } from "./handlers/settings.js";
import { platformDb } from "./platform-db.js";

// Once a day, permanently delete trashed items older than the retention window
// from every workspace DB. The purge deletes children explicitly — the FK
// pragma is off in this codebase, so nothing cascades on its own. Runs
// outside the Effect server runtime (like the backup scheduler), so it builds a
// self-contained Effect and runs it with Effect.runPromise.

const runTrashSweep = Effect.gen(function* () {
	const days = loadSettings().trashRetentionDays ?? 30;
	const wdb = yield* WorkspaceDb;
	const workspaceIds = (
		platformDb.prepare("SELECT id FROM workspaces").all() as { id: string }[]
	).map((r) => r.id);
	for (const id of workspaceIds) {
		const res = yield* Databases.purgeExpired(days).pipe(
			Effect.provide(wdb.getLayer(id)),
		);
		if (res.pages || res.databases || res.records) {
			yield* Effect.logInfo(
				`[trash-sweep] workspace ${id}: purged ${res.pages} pages, ${res.databases} databases, ${res.records} records (retention ${days}d)`,
			);
		}
	}
}).pipe(Effect.provide(WorkspaceDbLive));

/** Start the trash retention sweep. Runs once immediately, then every 24h. */
export function startTrashSweep() {
	const tick = () =>
		Effect.runPromise(runTrashSweep).catch((e) =>
			console.error("[trash-sweep] failed:", e),
		);
	setInterval(tick, 24 * 60 * 60 * 1000);
	tick();
}
