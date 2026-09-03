import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Effect } from "effect";
import { WorkspaceDb, WorkspaceDbLive, workspaceDbFile } from "./db.js";
import * as Databases from "./handlers/databases.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const workspacesDir = process.env.DATA_DIR
	? path.join(process.env.DATA_DIR, "workspaces")
	: path.join(__dirname, "../../../.data", "workspaces");

/**
 * CLI entrypoint for `backfillSyncLinkedRows` (databases.ts): forces the
 * missing satellite rows into existence for every workspace, for masters
 * that predate their relation field's `sync_linked_row` flag being turned
 * on. Opening a workspace's WorkspaceDb layer applies pending migrations
 * first, so a fresh `trashed_with`/`sync_linked_row` column is there before
 * the backfill query runs against it.
 */
const backfillAllWorkspaces = Effect.gen(function* () {
	const workspaceDb = yield* WorkspaceDb;
	if (!fs.existsSync(workspacesDir)) {
		yield* Effect.log(`No workspaces directory at ${workspacesDir}`);
		return;
	}
	const workspaceIds = fs
		.readdirSync(workspacesDir)
		.filter(
			(f) => f.endsWith(".db") && !f.includes("-wal") && !f.includes("-shm"),
		)
		.map((f) => f.replace(/\.db$/, ""));

	for (const workspaceId of workspaceIds) {
		const layer = workspaceDb.getLayer(workspaceId);
		const result = yield* Databases.backfillSyncLinkedRows.pipe(
			Effect.provide(layer),
		);
		yield* Effect.log(
			`${workspaceId} (${workspaceDbFile(workspaceId)}): created ${result.created} satellite row(s)`,
		);
	}
});

await Effect.runPromise(
	backfillAllWorkspaces.pipe(
		Effect.provide(WorkspaceDbLive),
		Effect.tap(() => Effect.log("Backfill complete")),
		Effect.catchCause(Effect.logFatal),
	),
);
