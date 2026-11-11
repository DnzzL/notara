import { Database } from "bun:sqlite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Context, Layer } from "effect";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const platformDbPath = process.env.DATA_DIR
	? path.join(process.env.DATA_DIR, "platform.db")
	: path.join(__dirname, "../../../.data", "platform.db");

const platformMigrationsDir = path.join(__dirname, "../migrations/platform");

// Ensure data directory exists before opening
const dataDir = path.dirname(platformDbPath);
if (!fs.existsSync(dataDir)) {
	fs.mkdirSync(dataDir, { recursive: true });
}

export class PlatformDb extends Context.Service<PlatformDb, Database>()(
	"PlatformDb",
) {}

/**
 * Applies SQL migrations from `dir` to `db`, tracking applied files in a
 * `_migrations` table. Idempotent: already-applied files are skipped.
 * On first use after upgrading from the old "catch already exists" approach,
 * existing migrations are recorded even if they throw "already exists".
 * Then reports/cleans orphan rows and turns foreign_keys ON for `db` (callers
 * that keep using this connection, like platform.db, get enforcement).
 */
export const applyMigrations = (db: Database, dir: string): void => {
	db.exec(`CREATE TABLE IF NOT EXISTS _migrations (
    name TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL
  )`);
	const applied = new Set<string>(
		(db.query("SELECT name FROM _migrations").all() as { name: string }[]).map(
			(r) => r.name,
		),
	);
	const files = fs
		.readdirSync(dir)
		.filter((f) => f.endsWith(".sql"))
		.sort();
	for (const file of files) {
		if (applied.has(file)) continue;
		const sql = fs.readFileSync(path.join(dir, file), "utf-8");
		try {
			db.exec(sql);
		} catch (e: any) {
			// Bootstrap: existing installs may have already applied this migration.
			// Record it in _migrations so future runs skip it cleanly.
			if (
				!e.message?.includes("already exists") &&
				!e.message?.includes("duplicate column")
			)
				throw e;
		}
		db.prepare(
			"INSERT OR IGNORE INTO _migrations (name, applied_at) VALUES (?, ?)",
		).run(file, new Date().toISOString());
	}
	checkForeignKeys(db);
	db.run("PRAGMA foreign_keys = ON");
};

type FkViolation = {
	table: string;
	rowid: number;
	parent: string;
	fkid: number;
};

/**
 * Reports orphan rows (one count per foreign key), then removes them if safe.
 * Safe = the FK is ON DELETE CASCADE (the parent is gone, so turning FKs on
 * would have deleted the row) and no surviving row still points at it. Anything
 * else (SET NULL / no-action FKs, or a survivor referencing an orphan) rolls
 * everything back and throws: the operator decides, we never guess.
 * Must run with foreign_keys OFF (the default for a new connection).
 */
export const checkForeignKeys = (db: Database): void => {
	const check = () =>
		db.query("PRAGMA foreign_key_check").all() as FkViolation[];
	const fks = new Map<
		string,
		{ id: number; from: string; on_delete: string }[]
	>();
	const fkOf = (v: FkViolation) => {
		if (!fks.has(v.table))
			fks.set(
				v.table,
				db.query(`PRAGMA foreign_key_list("${v.table}")`).all() as any[],
			);
		return fks.get(v.table)!.find((r) => r.id === v.fkid)!;
	};
	const summary = (vs: FkViolation[]) => {
		const counts: Record<string, number> = {};
		for (const v of vs) {
			const k = `${v.table}.${fkOf(v).from} -> ${v.parent}`;
			counts[k] = (counts[k] ?? 0) + 1;
		}
		return JSON.stringify(counts);
	};
	const found = check();
	if (found.length === 0) return;
	console.log(`foreign key check: orphan rows ${summary(found)}`);
	db.transaction(() => {
		for (let vs = found; vs.length; vs = check()) {
			const stuck = vs.filter((v) => fkOf(v).on_delete !== "CASCADE");
			if (stuck.length)
				throw new Error(
					`Cannot turn foreign keys on: orphan rows that are not safe to delete ${summary(stuck)}. Fix them by hand, then restart.`,
				);
			for (const v of vs)
				db.run(`DELETE FROM "${v.table}" WHERE rowid = ?`, [v.rowid]);
		}
	})();
	console.log("foreign key check: orphan rows deleted");
};

/** Apply the platform-DB migrations to a given Database (used by tests). */
export const runPlatformMigrations = (db: Database): void => {
	applyMigrations(db, platformMigrationsDir);
};

/** Single shared Database instance for platform.db (users, workspaces, auth). */
export const platformDb = new Database(platformDbPath);
applyMigrations(platformDb, platformMigrationsDir);

export const PlatformDbLive = Layer.succeed(PlatformDb, platformDb);

/** For tests that need an isolated database at a custom path. */
export const makePlatformDbLayer = (
	dbPath: string = platformDbPath,
): Layer.Layer<PlatformDb> => {
	const dir = path.dirname(dbPath);
	if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
	const db = new Database(dbPath);
	applyMigrations(db, platformMigrationsDir);
	return Layer.succeed(PlatformDb, db);
};
