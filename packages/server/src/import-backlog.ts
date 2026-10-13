/**
 * `bun packages/server/src/import-backlog.ts <workspaceId> <authorUserId> [backlogDir]`
 *
 * Imports a Backlog.md project into a workspace's database (NOT-156). Safe to
 * run again: tasks already imported are skipped.
 */
import { Effect, Layer } from "effect";
import { WorkspaceDb, WorkspaceDbLive } from "./db.js";
import { importBacklog } from "./import/backlog.js";
import { PlatformDbLive } from "./platform-db.js";

const [workspaceId, authorId, dir = "backlog"] = process.argv.slice(2);
if (!workspaceId || !authorId) {
	console.error(
		"Usage: bun packages/server/src/import-backlog.ts <workspaceId> <authorUserId> [backlogDir]",
	);
	process.exit(1);
}

await Effect.runPromise(
	Effect.gen(function* () {
		const wdb = yield* WorkspaceDb;
		const result = yield* importBacklog({ dir, workspaceId, authorId }).pipe(
			Effect.provide(Layer.merge(wdb.getLayer(workspaceId), PlatformDbLive)),
		);
		yield* Effect.log(
			`Imported ${result.imported} tasks, skipped ${result.skipped} already imported, into database ${result.databaseId}`,
		);
		for (const file of result.unreadable)
			yield* Effect.logWarning(`Not a task this import can read: ${file}`);
	}).pipe(
		Effect.provide(WorkspaceDbLive),
		Effect.catchCause((cause) =>
			Effect.logFatal(cause).pipe(
				Effect.andThen(
					Effect.sync(() => {
						process.exitCode = 1;
					}),
				),
			),
		),
	),
);
