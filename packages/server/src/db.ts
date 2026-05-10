import { Effect, Layer } from "effect";
import { SqliteClient } from "@effect/sql-sqlite-bun";
import { Database } from "bun:sqlite";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const dbPath = process.env.DATA_DIR
  ? path.join(process.env.DATA_DIR, "notes.db")
  : path.join(__dirname, "../../.data", "notes.db");

export const makeSqliteLayer = (filename: string = dbPath) =>
  SqliteClient.layer({ filename });

export const SqliteLive = makeSqliteLayer();

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
      db.exec(sqlContent);
    }
  } finally {
    db.close();
  }
});
