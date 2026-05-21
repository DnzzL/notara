import { betterAuth } from "better-auth";
import { BunSqliteDialect } from "kysely-bun-sqlite";
import { Database } from "bun:sqlite";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const platformDbPath = process.env.DATA_DIR
  ? path.join(process.env.DATA_DIR, "platform.db")
  : path.join(__dirname, "../../../.data", "platform.db");

const dataDir = path.dirname(platformDbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(platformDbPath);

export const auth = betterAuth({
  database: {
    dialect: new BunSqliteDialect({ database: db }),
    type: "sqlite",
  },
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      enabled: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    },
  },
  trustedOrigins: process.env.TRUSTED_ORIGINS?.split(",") ?? ["http://localhost:5173"],
});

export type AuthSession = typeof auth.$Infer.Session;
export type AuthUser = typeof auth.$Infer.Session.user;
