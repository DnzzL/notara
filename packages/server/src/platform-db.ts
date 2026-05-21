import { Effect, Layer, Context } from "effect";
import { Database } from "bun:sqlite";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const platformDbPath = process.env.DATA_DIR
  ? path.join(process.env.DATA_DIR, "platform.db")
  : path.join(__dirname, "../../../.data", "platform.db");

export class PlatformDb extends Context.Tag("PlatformDb")<PlatformDb, Database>() {}

export const runPlatformMigrations = (db: Database): void => {
  const migrationsDir = path.join(__dirname, "../migrations/platform");
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
        console.log(`Platform migration ${file}: already applied, skipping`);
      } else {
        throw e;
      }
    }
  }
};

export const makePlatformDbLayer = (dbPath: string = platformDbPath): Layer.Layer<PlatformDb> => {
  const dataDir = path.dirname(dbPath);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  const db = new Database(dbPath);
  runPlatformMigrations(db);
  return Layer.succeed(PlatformDb, db);
};

export const PlatformDbLive = makePlatformDbLayer();
