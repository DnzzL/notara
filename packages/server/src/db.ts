import { Effect, Layer, Context } from "effect";
import type { ConfigError } from "effect/ConfigError";
import { SqliteClient } from "@effect/sql-sqlite-bun";
import type { SqlClient as SqlClientType } from "@effect/sql";
import { Database } from "bun:sqlite";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Go up from src/ to packages/ to repo root
const dbPath = process.env.DATA_DIR
  ? path.join(process.env.DATA_DIR, "notes.db")
  : path.join(__dirname, "../../../.data", "notes.db");

// Ensure data directory exists
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

export const makeSqliteLayer = (filename: string = dbPath) =>
  SqliteClient.layer({ filename });

export const SqliteLive = makeSqliteLayer();

// --- Per-workspace DB service ---

const workspacesDir = process.env.DATA_DIR
  ? path.join(process.env.DATA_DIR, "workspaces")
  : path.join(__dirname, "../../../.data", "workspaces");

const connectionCache = new Map<string, Layer.Layer<SqlClientType.SqlClient>>();

const runWorkspaceMigrations = (db: Database, migrationsDir: string): void => {
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf-8");
    try {
      db.exec(sql);
    } catch (e: any) {
      if (e.message?.includes("already exists") || e.message?.includes("duplicate column")) {
        // already applied
      } else {
        throw e;
      }
    }
  }
};

type WorkspaceLayer = Layer.Layer<SqlClientType.SqlClient, ConfigError>;

export class WorkspaceDb extends Context.Tag("WorkspaceDb")<
  WorkspaceDb,
  { getLayer: (workspaceId: string) => WorkspaceLayer }
>() {}

const workspaceLayerCache = new Map<string, WorkspaceLayer>();

export const WorkspaceDbLive = Layer.succeed(
  WorkspaceDb,
  {
    getLayer: (workspaceId: string) => {
      const cached = workspaceLayerCache.get(workspaceId);
      if (cached) return cached;

      if (!fs.existsSync(workspacesDir)) {
        fs.mkdirSync(workspacesDir, { recursive: true });
      }
      const filename = path.join(workspacesDir, `${workspaceId}.db`);

      // Run migrations on first open
      const migrationsDir = path.join(__dirname, "../migrations");
      const db = new Database(filename);
      runWorkspaceMigrations(db, migrationsDir);
      db.close();

      const layer = makeSqliteLayer(filename) as WorkspaceLayer;
      workspaceLayerCache.set(workspaceId, layer);
      return layer;
    },
  },
);

// Run migrations using a fresh Database connection with exec()
// exec() handles multi-statement SQL including triggers with BEGIN...END
export const runMigrations = Effect.gen(function* () {
  const migrationsDir = path.join(__dirname, "../migrations");
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  // Create a temporary connection just for migrations
  const db = new Database(dbPath);
  try {
    for (const file of files) {
      const sqlContent = fs.readFileSync(path.join(migrationsDir, file), "utf-8");
      try {
        db.exec(sqlContent);
      } catch (e: any) {
        // Log but continue if migration fails (e.g., column already exists)
        // This allows idempotent migrations
        if (e.message?.includes("already exists") || e.message?.includes("duplicate column")) {
          console.log(`Migration ${file}: already applied, skipping`);
        } else {
          throw e;
        }
      }
    }
  } finally {
    db.close();
  }
});
