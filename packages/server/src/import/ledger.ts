/**
 * Identity for imported things.
 *
 * The Notion importer used to hold three in-memory maps for the duration of one
 * run and mint a fresh ULID for every row it wrote. Nothing was persisted, so
 * re-running the same export was a clone *by definition* — one workspace ended
 * up with thirteen copies of every database. This module is the missing piece:
 * a persisted map from what a thing is called in the export to what it is called
 * here.
 *
 * The interface is deliberately one question — resolve-or-create — because that
 * is the only one the importer needs, and because answering it in one place is
 * what turns "clone" into "upsert" everywhere at once:
 *
 *     const { id, created } = yield* ledger.resolve("page", guid)
 *
 * `created` is what lets a caller choose between INSERT and UPDATE without
 * knowing anything about how identity is stored.
 *
 * The second thing it provides is **scope**: which local ids this run touched.
 * Two passes of the importer used to query the whole workspace — placeholder
 * resolution scanned every block for database references, and the empty-page
 * prune deleted any empty page it found — so a second import could rewrite or
 * delete the first one's work, or a page the user wrote by hand in between.
 */

import { Effect } from "effect";
import { SqlClient } from "effect/unstable/sql";
import { ulid } from "ulidx";

export type ImportKind = "page" | "database" | "field" | "record";

export type Resolution = {
	readonly id: string;
	/** True when this run minted the id; false when a previous import did. */
	readonly created: boolean;
};

/**
 * Composite keys for the kinds Notion gives no identifier of its own.
 *
 * A CSV export carries no per-column or per-row id, so a field is identified by
 * its header within its database and a record by its title within its database.
 * Renaming a column in Notion therefore reads as a new column on re-import.
 * That is the export format's limitation, not a preference — and it is better
 * than duplicating the whole database on every run.
 */
export const fieldKey = (databaseId: string, header: string) =>
	`${databaseId}::${header}`;

export const recordKey = (databaseId: string, title: string) =>
	`${databaseId}::${title}`;

export type ImportLedger = {
	/** The id this run should use for `sourceKey`, minting one if it is new. */
	readonly resolve: (
		kind: ImportKind,
		sourceKey: string,
	) => Effect.Effect<Resolution, never, SqlClient.SqlClient>;
	/** Local ids of the given kind that this run touched. */
	readonly scopedIds: (
		kind: ImportKind,
	) => Effect.Effect<readonly string[], never, SqlClient.SqlClient>;
	/** This run's identifier, for diagnostics. */
	readonly runId: string;
};

/**
 * Open a ledger for one import run.
 *
 * `source` names the exporting system so a future importer for something other
 * than Notion cannot collide with these keys.
 */
export const openLedger = (source = "notion"): ImportLedger => {
	const runId = ulid();

	const resolve = (kind: ImportKind, sourceKey: string) =>
		Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient;

			const existing = (yield* sql
				.unsafe(
					"SELECT local_id FROM import_ledger WHERE source = ? AND kind = ? AND source_key = ?",
					[source, kind, sourceKey],
				)
				.pipe(Effect.orDie)) as unknown as ReadonlyArray<{ local_id: string }>;

			if (existing.length > 0) {
				// Claim it for this run, so scoping sees it even though it is not new.
				yield* sql
					.unsafe(
						"UPDATE import_ledger SET last_run_id = ? WHERE source = ? AND kind = ? AND source_key = ?",
						[runId, source, kind, sourceKey],
					)
					.pipe(Effect.orDie);
				return { id: existing[0].local_id, created: false };
			}

			const id = ulid();
			yield* sql
				.unsafe(
					"INSERT INTO import_ledger (source, kind, source_key, local_id, last_run_id, created_at) VALUES (?, ?, ?, ?, ?, ?)",
					[source, kind, sourceKey, id, runId, new Date().toISOString()],
				)
				.pipe(Effect.orDie);
			return { id, created: true };
		});

	const scopedIds = (kind: ImportKind) =>
		Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient;
			const rows = (yield* sql
				.unsafe(
					"SELECT local_id FROM import_ledger WHERE source = ? AND kind = ? AND last_run_id = ?",
					[source, kind, runId],
				)
				.pipe(Effect.orDie)) as unknown as ReadonlyArray<{ local_id: string }>;
			return rows.map((r) => r.local_id);
		});

	return { resolve, scopedIds, runId };
};
