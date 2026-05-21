import { Layer, Context } from "effect";
import { Database } from "bun:sqlite";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

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

export class PlatformDb extends Context.Tag("PlatformDb")<PlatformDb, Database>() {}

/**
 * Applies SQL migrations from `dir` to `db`, tracking applied files in a
 * `_migrations` table. Idempotent: already-applied files are skipped.
 * On first use after upgrading from the old "catch already exists" approach,
 * existing migrations are recorded even if they throw "already exists".
 */
export const applyMigrations = (db: Database, dir: string): void => {
  db.exec(`CREATE TABLE IF NOT EXISTS _migrations (
    name TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL
  )`);
  const applied = new Set<string>(
    (db.query("SELECT name FROM _migrations").all() as { name: string }[]).map(r => r.name)
  );
  const files = fs.readdirSync(dir).filter(f => f.endsWith(".sql")).sort();
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = fs.readFileSync(path.join(dir, file), "utf-8");
    try {
      db.exec(sql);
    } catch (e: any) {
      // Bootstrap: existing installs may have already applied this migration.
      // Record it in _migrations so future runs skip it cleanly.
      if (!e.message?.includes("already exists") && !e.message?.includes("duplicate column")) throw e;
    }
    db.prepare("INSERT OR IGNORE INTO _migrations (name, applied_at) VALUES (?, ?)")
      .run(file, new Date().toISOString());
  }
};

/** Single shared Database instance for platform.db (users, workspaces, auth). */
export const platformDb = new Database(platformDbPath);
applyMigrations(platformDb, platformMigrationsDir);

export const PlatformDbLive = Layer.succeed(PlatformDb, platformDb);

/** For tests that need an isolated database at a custom path. */
export const makePlatformDbLayer = (dbPath: string = platformDbPath): Layer.Layer<PlatformDb> => {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const db = new Database(dbPath);
  applyMigrations(db, platformMigrationsDir);
  return Layer.succeed(PlatformDb, db);
};
