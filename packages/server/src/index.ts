import { Effect, Layer, pipe } from "effect";
import * as HttpLayerRouter from "@effect/platform/HttpLayerRouter";
import * as HttpRouter from "@effect/platform/HttpRouter";
import * as HttpServerResponse from "@effect/platform/HttpServerResponse";
import * as HttpServerRequest from "@effect/platform/HttpServerRequest";

import { NodeHttpServer, NodeRuntime } from "@effect/platform-node";
import * as RpcServer from "@effect/rpc/RpcServer";
import * as RpcSerialization from "@effect/rpc/RpcSerialization";
import { SqliteLive, runMigrations, WorkspaceDb, WorkspaceDbLive } from "./db.js";
import * as Pages from "./handlers/pages.js";
import * as Blocks from "./handlers/blocks.js";
import * as Databases from "./handlers/databases.js";
import * as Search from "./handlers/search.js";
import * as ImportExport from "./handlers/importExport.js";
import * as Upload from "./handlers/upload.js";
import * as Workspaces from "./handlers/workspaces.js";
import * as ApiKeys from "./handlers/api-keys.js";
import { loadSettings, saveSettings } from "./handlers/settings.js";
import { triggerBackup, listBackups } from "./handlers/backup.js";
import { restoreBackup } from "./handlers/restore.js";
import { AppRpc, RecordFieldValue } from "@notion-alt/shared";
import { registerV1Routes } from "./api-v1/routes.js";
import { auth } from "./auth.js";
import { startBackupScheduler } from "./backup-scheduler.js";
import { startTrashSweep } from "./trash-sweeper.js";
import { PlatformDbLive, PlatformDb, platformDb } from "./platform-db.js";
import * as Permissions from "./handlers/permissions.js";
import { resolveWorkspaceContext, getSessionUser, WorkspaceContext, AuthError, withWorkspaceDb, withAuthedWorkspace } from "./workspace-context.js";
import { corsHeaders, checkRateLimit, getIp, tooManyRequests } from "./middleware.js";
import { makeHeartbeatHandler, makeStreamHandler } from "./presence/routes.js";
import { presence } from "./presence/index.js";
import { createServer } from "node:http";
import * as path from "node:path";
import * as fs from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = path.join(__dirname, "../..");

// Static file paths
const possibleDistPaths = [
  path.join(process.cwd(), "packages/app/dist"),
  path.join(process.cwd(), "app/dist"),
  "/app/packages/app/dist",
];

let appDist: string | null = null;
for (const p of possibleDistPaths) {
  if (fs.existsSync(p) && fs.existsSync(path.join(p, "index.html"))) {
    appDist = p;
    break;
  }
}

if (appDist) {
  console.log("Serving static files from:", appDist);
} else {
  console.log("No frontend dist found - API only mode");
}

const mimeTypes: Record<string, string> = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

// ── Env validation ────────────────────────────────────────────────────────────
const REQUIRED_ENV: Array<{ key: string; hint: string }> = [
  { key: "BETTER_AUTH_SECRET", hint: "generate with: openssl rand -hex 32" },
];

function validateEnv(): void {
  const missing = REQUIRED_ENV.filter(({ key }) => !process.env[key]?.trim());
  if (missing.length === 0) return;
  console.error("\n[startup] Missing required environment variables:\n");
  for (const { key, hint } of missing) {
    console.error(`  ${key}  (${hint})`);
  }
  console.error("\nSet these in your .env file or environment before starting the server.\n");
  process.exit(1);
}

validateEnv();

// Static file handler + import upload route as an Effect
const staticFilesRoute = Effect.gen(function* () {
  const router = yield* HttpLayerRouter.HttpRouter;
  const wdb = yield* WorkspaceDb;

  // Better Auth handler — mount before RPC (handles GET and POST)
  const authHandlerInner = Effect.gen(function* () {
    const request = yield* HttpServerRequest.HttpServerRequest;
    const url = new URL(request.url, "http://localhost");
    const bodyBuffer = request.method !== "GET" && request.method !== "HEAD"
      ? Buffer.from(yield* request.arrayBuffer)
      : undefined;
    const fetchRequest = new Request(url.toString(), {
      method: request.method,
      headers: request.headers as HeadersInit,
      body: bodyBuffer,
    });
    const response = yield* Effect.promise(() => auth.handler(fetchRequest));
    const body = yield* Effect.promise(() => response.arrayBuffer());
    return HttpServerResponse.uint8Array(new Uint8Array(body), {
      status: response.status,
      headers: {
        ...Object.fromEntries(response.headers.entries()),
        ...corsHeaders,
      },
    });
  }).pipe(
    Effect.catchAllCause((cause) => {
      const msg = cause._tag === "Fail" ? String(cause.error) : cause.toString();
      return HttpServerResponse.text(JSON.stringify({ error: msg }), {
        status: 500, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    })
  );
  // Auth mutation endpoints get a stricter rate limit (10 req/min per IP)
  const authHandlerStrict = Effect.gen(function* () {
    const req = yield* HttpServerRequest.HttpServerRequest;
    const isAuthMutation = /\/(sign-in|sign-up|request-password-reset|reset-password)/.test(req.url);
    if (isAuthMutation && !checkRateLimit(`${getIp(req)}:auth`, 10)) return tooManyRequests(60);
    return yield* authHandlerInner;
  });
  yield* router.add("GET", "/api/auth/*", authHandlerInner);
  yield* router.add("POST", "/api/auth/*", authHandlerStrict);

  // Health check
  yield* router.add("GET", "/health", Effect.succeed(
    HttpServerResponse.text("ok", { status: 200 })
  ));

  // Settings GET
  yield* router.add("GET", "/api/settings", Effect.gen(function* () {
    const settings = loadSettings();
    return HttpServerResponse.text(JSON.stringify(settings), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }));

  // Settings POST
  yield* router.add("POST", "/api/settings", Effect.gen(function* () {
    const request = yield* HttpServerRequest.HttpServerRequest;
    const ab = yield* request.arrayBuffer;
    const body = JSON.parse(Buffer.from(ab).toString("utf-8"));
    saveSettings(body);
    return HttpServerResponse.text(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }).pipe(
    Effect.catchAllCause((cause) => {
      const msg = cause._tag === "Fail" ? String(cause.error) : cause.toString();
      return HttpServerResponse.text(JSON.stringify({ error: msg }), {
        status: 500, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    })
  ));

  // Backup trigger
  yield* router.add("POST", "/api/backup/trigger", Effect.gen(function* () {
    const result = yield* Effect.promise(() => triggerBackup());
    return HttpServerResponse.text(JSON.stringify(result), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }).pipe(
    Effect.catchAllCause((cause) => {
      const msg = cause._tag === "Fail" ? String(cause.error) : cause.toString();
      return HttpServerResponse.text(JSON.stringify({ error: msg }), {
        status: 500, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    })
  ));

  // ── Admin routes ──────────────────────────────────────────────────────────
  const adminEmails = (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim()).filter(Boolean);

  const requireAdmin = <A>(inner: Effect.Effect<A, unknown, any>) =>
    Effect.gen(function* () {
      if (adminEmails.length === 0) {
        return HttpServerResponse.text(JSON.stringify({ error: "Admin not configured" }), {
          status: 403, headers: { "Content-Type": "application/json", ...corsHeaders },
        }) as unknown as A;
      }
      const req = yield* HttpServerRequest.HttpServerRequest;
      const headers = new Headers(req.headers as Record<string, string>);
      const session = yield* Effect.promise(() => auth.api.getSession({ headers }));
      if (!session || !adminEmails.includes(session.user.email)) {
        return HttpServerResponse.text(JSON.stringify({ error: "Forbidden" }), {
          status: 403, headers: { "Content-Type": "application/json", ...corsHeaders },
        }) as unknown as A;
      }
      return yield* inner;
    });

  // List available S3 backups (admin only)
  yield* router.add("GET", "/api/backup/list", requireAdmin(Effect.gen(function* () {
    const items = yield* Effect.promise(() => listBackups());
    return HttpServerResponse.text(JSON.stringify(items), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }).pipe(
    Effect.catchAllCause((cause) => {
      const msg = cause._tag === "Fail" ? String(cause.error) : cause.toString();
      return HttpServerResponse.text(JSON.stringify({ error: msg }), {
        status: 500, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    })
  )));

  // Restore the whole instance from an S3 backup (admin only).
  // On success the process exits so Docker relaunches the server with fresh
  // SQLite handles on the restored files — open handles can't be hot-swapped.
  yield* router.add("POST", "/api/backup/restore", requireAdmin(Effect.gen(function* () {
    const request = yield* HttpServerRequest.HttpServerRequest;
    const ab = yield* request.arrayBuffer;
    const body = JSON.parse(Buffer.from(ab).toString("utf-8")) as { key?: string };
    if (!body.key) throw new Error("Missing backup key");
    const result = yield* Effect.promise(() => restoreBackup(body.key!));
    // Flush the response, then exit so the container restarts.
    setTimeout(() => {
      console.log("[restore] restored from", result.restoredFrom, "— exiting for restart");
      process.exit(0);
    }, 250);
    return HttpServerResponse.text(JSON.stringify(result), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }).pipe(
    Effect.catchAllCause((cause) => {
      const msg = cause._tag === "Fail" ? String(cause.error) : cause.toString();
      return HttpServerResponse.text(JSON.stringify({ error: msg }), {
        status: 500, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    })
  )));

  yield* router.add("GET", "/api/admin/users", requireAdmin(Effect.gen(function* () {
    const users = platformDb
      .prepare(
        `SELECT u.id, u.name, u.email, u.createdAt,
                COUNT(DISTINCT wm.workspace_id) as workspace_count
         FROM "user" u
         LEFT JOIN workspace_members wm ON wm.user_id = u.id
         GROUP BY u.id
         ORDER BY u.createdAt DESC`,
      )
      .all() as any[];
    return HttpServerResponse.text(JSON.stringify(users), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  })));

  yield* router.add("GET", "/api/admin/workspaces", requireAdmin(Effect.gen(function* () {
    const workspaces = platformDb
      .prepare(
        `SELECT w.id, w.name, w.slug, w.created_at,
                COUNT(wm.user_id) as member_count
         FROM workspaces w
         LEFT JOIN workspace_members wm ON wm.workspace_id = w.id
         GROUP BY w.id
         ORDER BY w.created_at DESC`,
      )
      .all() as any[];
    return HttpServerResponse.text(JSON.stringify(workspaces), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  })));

  yield* router.add("DELETE", "/api/admin/users/:userId", requireAdmin(Effect.gen(function* () {
    const params = yield* HttpRouter.params;
    const userId = params["userId"] as string | undefined;
    if (!userId) {
      return HttpServerResponse.text(JSON.stringify({ error: "Missing userId" }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    platformDb.prepare("DELETE FROM workspace_members WHERE user_id = ?").run(userId);
    platformDb.prepare(`DELETE FROM "user" WHERE id = ?`).run(userId);
    return HttpServerResponse.text(JSON.stringify({ deleted: true }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  })));

  // Presence (collaboration) routes — wdb is closed over so the per-request
  // handler doesn't need WorkspaceDb in its own context.
  yield* router.add("POST", "/api/presence/heartbeat", makeHeartbeatHandler(wdb));
  yield* router.add("GET", "/api/presence/stream", makeStreamHandler(wdb));

  // Handle CORS preflight
  yield* router.add("OPTIONS", "/*", Effect.succeed(
    HttpServerResponse.empty({ status: 204, headers: corsHeaders })
  ));

  // Import upload route
  yield* router.add("POST", "/import-notion", Effect.gen(function* () {
    const request = yield* HttpServerRequest.HttpServerRequest;

    const ab = yield* request.arrayBuffer;
    const buffer = Buffer.from(ab);

    if (buffer.length === 0) {
      return HttpServerResponse.text(JSON.stringify({ error: "Empty request body" }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const cd = request.headers["content-disposition"] || "";
    const filenameMatch = cd.match(/filename="([^"]+)"/);
    const fileName = filenameMatch ? filenameMatch[1] : "notion-export.zip";

    const workspaceId = request.headers["x-workspace-id"] as string | undefined;
    const dbLayer = workspaceId ? wdb.getLayer(workspaceId) : SqliteLive;

    const result = yield* ImportExport.importNotionZip(buffer, fileName).pipe(
      Effect.provide(dbLayer)
    );

    return HttpServerResponse.text(JSON.stringify({
      pagesImported: result.pagesImported,
      databasesImported: result.databasesImported,
    }), { headers: { "Content-Type": "application/json", ...corsHeaders } });
  }).pipe(
    Effect.catchAllCause((cause) => {
      const msg = cause._tag === "Fail"
        ? String(cause.error)
        : cause.toString();
      return HttpServerResponse.text(JSON.stringify({ error: msg }), {
        status: 500, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    })
  ));

  // File upload route. Client sends raw bytes; metadata travels in headers.
  // Headers: X-Page-Id, X-File-Name (URL-encoded), Content-Type (MIME).
  yield* router.add("POST", "/api/upload", Effect.gen(function* () {
    const request = yield* HttpServerRequest.HttpServerRequest;
    const pageId = request.headers["x-page-id"];
    const fileNameRaw = request.headers["x-file-name"];
    const mimeType = request.headers["content-type"] || "application/octet-stream";

    if (!pageId || !fileNameRaw) {
      return HttpServerResponse.text(
        JSON.stringify({ error: "Missing X-Page-Id or X-File-Name header" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const fileName = decodeURIComponent(fileNameRaw);
    const ab = yield* request.arrayBuffer;
    const fileBuffer = Buffer.from(ab);

    if (fileBuffer.length === 0) {
      return HttpServerResponse.text(
        JSON.stringify({ error: "Empty file body" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const uploadWorkspaceId = request.headers["x-workspace-id"] as string | undefined;
    const uploadDbLayer = uploadWorkspaceId ? wdb.getLayer(uploadWorkspaceId) : SqliteLive;

    const result = yield* Upload.uploadFile({ pageId, fileName, mimeType, fileBuffer }).pipe(
      Effect.provide(uploadDbLayer)
    );

    return HttpServerResponse.text(JSON.stringify(result), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }).pipe(
    Effect.catchAllCause((cause) => {
      const msg = cause._tag === "Fail" ? String(cause.error) : cause.toString();
      return HttpServerResponse.text(JSON.stringify({ error: msg }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    })
  ));

  // Attachment serving route
  yield* router.add("GET", "/attachments/:fileName", Effect.gen(function* () {
    const params = yield* HttpRouter.params;
    const fileName = params["fileName"] as string | undefined;

    if (!fileName) {
      return HttpServerResponse.text("Not found", { status: 404, headers: corsHeaders });
    }

    const dataDir = process.env.DATA_DIR
      ? path.join(process.env.DATA_DIR, "attachments")
      : path.join(rootDir, ".data", "attachments");
    const filePath = path.join(dataDir, fileName);

    if (!fs.existsSync(filePath)) {
      return HttpServerResponse.text("Not found", { status: 404, headers: corsHeaders });
    }

    const ext = path.extname(filePath);
    const contentType = mimeTypes[ext] || "application/octet-stream";
    const content = fs.readFileSync(filePath);

    return HttpServerResponse.uint8Array(new Uint8Array(content), {
      headers: { "Content-Type": contentType, ...corsHeaders },
    });
  }));

  if (!appDist) return;

  yield* router.add("GET", "/*", Effect.gen(function* () {
    const request = yield* HttpServerRequest.HttpServerRequest;
    let urlPath = request.url.split("?")[0];
    if (urlPath === "/" || urlPath === "") urlPath = "/index.html";

    let filePath = path.join(appDist!, urlPath);

    if (!fs.existsSync(filePath)) {
      filePath = path.join(appDist!, "index.html");
    }

    if (!fs.existsSync(filePath)) {
      return HttpServerResponse.text("Not found", { status: 404, headers: corsHeaders });
    }

    const ext = path.extname(filePath);
    const contentType = mimeTypes[ext] || "application/octet-stream";
    const content = fs.readFileSync(filePath);

    return HttpServerResponse.uint8Array(new Uint8Array(content), {
      headers: { "Content-Type": contentType, ...corsHeaders },
    });
  }));
});

// Layer that adds static file routes + import upload
const StaticFilesLive = Layer.effectDiscard(staticFilesRoute);

// Layer that adds the /api/v1 REST routes + /api/docs
const ApiV1Live = Layer.effectDiscard(registerV1Routes);

// RPC handlers layer
const rpcHandlersLayer = AppRpc.toLayer({
  listPages: () =>
    withAuthedWorkspace(({ userId, workspaceId, role }) =>
      Effect.gen(function* () {
        const all = yield* Pages.listPages;
        return yield* Permissions.filterPagesByPermission(userId, workspaceId, role, all);
      }),
    ).pipe(Effect.orDie),
  getPage: ({ id }) =>
    withAuthedWorkspace(({ userId, workspaceId }) =>
      Effect.gen(function* () {
        yield* Permissions.checkPagePermission(userId, workspaceId, id, "viewer");
        return yield* Pages.getPage(id);
      }),
    ).pipe(Effect.orDie),
  createPage: (req) => withWorkspaceDb(Pages.createPage(req)).pipe(Effect.orDie),
  updatePage: (req) =>
    withAuthedWorkspace(({ userId, workspaceId }) =>
      Effect.gen(function* () {
        yield* Permissions.checkPagePermission(userId, workspaceId, req.id, "editor");
        const page = yield* Pages.updatePage(req);
        presence.broadcast(workspaceId, req.id, {
          type: "page.metaUpdated",
          actorUserId: userId,
          fields: { title: page.title, icon: page.icon, coverUrl: page.coverUrl },
        });
        return page;
      }),
    ).pipe(Effect.orDie),
  deletePage: ({ id }) =>
    withAuthedWorkspace(({ userId, workspaceId }) =>
      Effect.gen(function* () {
        yield* Permissions.checkPagePermission(userId, workspaceId, id, "editor");
        return yield* Pages.deletePage(id);
      }),
    ).pipe(Effect.orDie),
  globalSearch: ({ query }) =>
    withAuthedWorkspace(({ userId, workspaceId, role }) =>
      Effect.gen(function* () {
        const results = yield* Search.globalSearch(query);
        const allPages = yield* Pages.listPages;
        const visible = yield* Permissions.filterPagesByPermission(userId, workspaceId, role, allPages);
        const visibleIds = new Set(visible.map((p) => p.id));
        return results.filter((r) => visibleIds.has(r.type === "page" ? r.id : r.pageId));
      }),
    ).pipe(Effect.orDie),
  movePage: (req) =>
    withAuthedWorkspace(({ userId, workspaceId }) =>
      Effect.gen(function* () {
        yield* Permissions.checkPagePermission(userId, workspaceId, req.id, "editor");
        return yield* Pages.movePage(req);
      }),
    ).pipe(Effect.orDie),
  reorderPages: ({ parentId, pageIds }) => withWorkspaceDb(Pages.reorderPages({ parentId, pageIds: [...pageIds] })).pipe(Effect.orDie),

  listBlocks: ({ pageId }) =>
    withAuthedWorkspace(({ userId, workspaceId }) =>
      Effect.gen(function* () {
        yield* Permissions.checkPagePermission(userId, workspaceId, pageId, "viewer");
        return yield* Blocks.listBlocks(pageId);
      }),
    ).pipe(Effect.orDie),
  createBlock: (req) =>
    withAuthedWorkspace(({ userId, workspaceId }) =>
      Effect.gen(function* () {
        yield* Permissions.checkPagePermission(userId, workspaceId, req.pageId, "editor");
        const block = yield* Blocks.createBlock(req);
        presence.broadcast(workspaceId, req.pageId, {
          type: "block.created",
          actorUserId: userId,
          block,
        });
        return block;
      }),
    ).pipe(Effect.orDie),
  updateBlock: (req) =>
    withAuthedWorkspace(({ userId, workspaceId }) =>
      Effect.gen(function* () {
        yield* Permissions.checkBlockPermission(userId, workspaceId, req.id, "editor");
        const pageId = yield* Blocks.getBlockPageId(req.id);
        if (pageId) {
          const holder = presence.lockHolder(workspaceId, pageId, req.id);
          if (holder && holder !== userId) {
            return yield* Effect.fail(new Error(`BlockLocked:${holder}`));
          }
        }
        const block = yield* Blocks.updateBlock(req);
        if (pageId) {
          presence.broadcast(workspaceId, pageId, {
            type: "block.updated",
            actorUserId: userId,
            blockId: req.id,
            content: req.content,
          });
        }
        return block;
      }),
    ).pipe(Effect.orDie),
  deleteBlock: ({ id }) =>
    withAuthedWorkspace(({ userId, workspaceId }) =>
      Effect.gen(function* () {
        yield* Permissions.checkBlockPermission(userId, workspaceId, id, "editor");
        const pageId = yield* Blocks.getBlockPageId(id);
        if (pageId) {
          const holder = presence.lockHolder(workspaceId, pageId, id);
          if (holder && holder !== userId) {
            return yield* Effect.fail(new Error(`BlockLocked:${holder}`));
          }
        }
        const result = yield* Blocks.deleteBlock(id);
        if (pageId) {
          presence.broadcast(workspaceId, pageId, {
            type: "block.deleted",
            actorUserId: userId,
            blockId: id,
          });
        }
        return result;
      }),
    ).pipe(Effect.orDie),
  reorderBlocks: ({ pageId, blockIds }) =>
    withAuthedWorkspace(({ userId, workspaceId }) =>
      Effect.gen(function* () {
        yield* Permissions.checkPagePermission(userId, workspaceId, pageId, "editor");
        const result = yield* Blocks.reorderBlocks(pageId, [...blockIds]);
        presence.broadcast(workspaceId, pageId, {
          type: "block.reordered",
          actorUserId: userId,
          blockIds: [...blockIds],
        });
        return result;
      }),
    ).pipe(Effect.orDie),
  getBacklinks: ({ pageId }) =>
    withAuthedWorkspace(({ userId, workspaceId, role }) =>
      Effect.gen(function* () {
        yield* Permissions.checkPagePermission(userId, workspaceId, pageId, "viewer");
        const all = yield* Blocks.getBacklinks(pageId);
        const allPages = yield* Pages.listPages;
        const visible = yield* Permissions.filterPagesByPermission(userId, workspaceId, role, allPages);
        const visibleIds = new Set(visible.map((p) => p.id));
        return all.filter((b) => visibleIds.has(b.pageId));
      }),
    ).pipe(Effect.orDie),

  listDatabases: ({ pageId }) =>
    withAuthedWorkspace(({ userId, workspaceId }) =>
      Effect.gen(function* () {
        yield* Permissions.checkPagePermission(userId, workspaceId, pageId, "viewer");
        return yield* Databases.listDatabases(pageId);
      }),
    ).pipe(Effect.orDie),
  listAllDatabases: () =>
    withAuthedWorkspace(({ userId, workspaceId, role }) =>
      Effect.gen(function* () {
        const all = yield* Databases.listAllDatabases;
        const allPages = yield* Pages.listPages;
        const visible = yield* Permissions.filterPagesByPermission(userId, workspaceId, role, allPages);
        const visibleIds = new Set(visible.map((p) => p.id));
        return all.filter((db) => visibleIds.has(db.pageId));
      }),
    ).pipe(Effect.orDie),
  getDatabase: ({ id }) =>
    withAuthedWorkspace(({ userId, workspaceId }) =>
      Effect.gen(function* () {
        yield* Permissions.checkDatabasePermission(userId, workspaceId, id, "viewer");
        return yield* Databases.getDatabase(id);
      }),
    ).pipe(Effect.orDie),
  createDatabase: (req) =>
    withAuthedWorkspace(({ userId, workspaceId }) =>
      Effect.gen(function* () {
        yield* Permissions.checkPagePermission(userId, workspaceId, req.pageId, "editor");
        return yield* Databases.createDatabase(req);
      }),
    ).pipe(Effect.orDie),
  listFields: ({ databaseId }) =>
    withAuthedWorkspace(({ userId, workspaceId }) =>
      Effect.gen(function* () {
        yield* Permissions.checkDatabasePermission(userId, workspaceId, databaseId, "viewer");
        return yield* Databases.listFields(databaseId);
      }),
    ).pipe(Effect.orDie),
  createField: (req) =>
    withAuthedWorkspace(({ userId, workspaceId }) =>
      Effect.gen(function* () {
        yield* Permissions.checkDatabasePermission(userId, workspaceId, req.databaseId, "editor");
        return yield* Databases.createField({
          databaseId: req.databaseId,
          name: req.name,
          type: req.type,
          options: req.options ? [...req.options] : null,
          relationTargetDbId: req.relationTargetDbId,
          formula: req.formula ?? null,
        });
      }),
    ).pipe(Effect.orDie),
  listRecords: ({ databaseId }) =>
    withAuthedWorkspace(({ userId, workspaceId }) =>
      Effect.gen(function* () {
        yield* Permissions.checkDatabasePermission(userId, workspaceId, databaseId, "viewer");
        return yield* Databases.listRecords(databaseId);
      }),
    ).pipe(Effect.orDie),
  listRecordsWithValues: ({ databaseId }) =>
    withAuthedWorkspace(({ userId, workspaceId }) =>
      Effect.gen(function* () {
        yield* Permissions.checkDatabasePermission(userId, workspaceId, databaseId, "viewer");
        return yield* Databases.listRecordsWithValues(databaseId);
      }),
    ).pipe(Effect.orDie),
  getRecordWithValues: ({ recordId }) =>
    withAuthedWorkspace(({ userId, workspaceId }) =>
      Effect.gen(function* () {
        yield* Permissions.checkRecordPermission(userId, workspaceId, recordId, "viewer");
        return yield* Databases.getRecordWithValues(recordId);
      }),
    ).pipe(Effect.orDie),
  createRecord: (req) =>
    withAuthedWorkspace(({ userId, workspaceId }) =>
      Effect.gen(function* () {
        yield* Permissions.checkDatabasePermission(userId, workspaceId, req.databaseId, "editor");
        return yield* Databases.createRecord(req);
      }),
    ).pipe(Effect.orDie),
  updateFieldValue: (req) =>
    withAuthedWorkspace(({ userId, workspaceId }) =>
      Effect.gen(function* () {
        yield* Permissions.checkRecordPermission(userId, workspaceId, req.recordId, "editor");
        const row = yield* Databases.updateFieldValue(req);
        return new RecordFieldValue({
          id: row.id as string,
          recordId: row.recordId as string,
          fieldId: row.fieldId as string,
          value: row.value as string,
        });
      }),
    ).pipe(Effect.orDie),
  deleteRecord: ({ id }) =>
    withAuthedWorkspace(({ userId, workspaceId }) =>
      Effect.gen(function* () {
        yield* Permissions.checkRecordPermission(userId, workspaceId, id, "editor");
        return yield* Databases.deleteRecord(id);
      }),
    ).pipe(Effect.orDie),
  listViews: ({ databaseId }) =>
    withAuthedWorkspace(({ userId, workspaceId }) =>
      Effect.gen(function* () {
        yield* Permissions.checkDatabasePermission(userId, workspaceId, databaseId, "viewer");
        return yield* Databases.listViews(databaseId);
      }),
    ).pipe(Effect.orDie),
  createView: (req) =>
    withAuthedWorkspace(({ userId, workspaceId }) =>
      Effect.gen(function* () {
        yield* Permissions.checkDatabasePermission(userId, workspaceId, req.databaseId, "editor");
        return yield* Databases.createView({
          databaseId: req.databaseId,
          name: req.name,
          type: req.type,
          groupByFieldId: req.groupByFieldId,
        });
      }),
    ).pipe(Effect.orDie),
  updateField: (req) =>
    withAuthedWorkspace(({ userId, workspaceId }) =>
      Effect.gen(function* () {
        yield* Permissions.checkFieldPermission(userId, workspaceId, req.id, "editor");
        return yield* Databases.updateField({
          id: req.id,
          name: req.name,
          type: req.type,
          options: req.options === undefined ? undefined : (req.options ? [...req.options] : null),
          relationTargetDbId: req.relationTargetDbId,
          formula: req.formula,
        });
      }),
    ).pipe(Effect.orDie),
  reorderFields: ({ databaseId, fieldIds }) =>
    withAuthedWorkspace(({ userId, workspaceId }) =>
      Effect.gen(function* () {
        yield* Permissions.checkDatabasePermission(userId, workspaceId, databaseId, "editor");
        return yield* Databases.reorderFields({ databaseId, fieldIds: [...fieldIds] });
      }),
    ).pipe(Effect.orDie),
  updateRecord: (req) =>
    withAuthedWorkspace(({ userId, workspaceId }) =>
      Effect.gen(function* () {
        yield* Permissions.checkRecordPermission(userId, workspaceId, req.id, "editor");
        return yield* Databases.updateRecord(req);
      }),
    ).pipe(Effect.orDie),
  reorderRecords: ({ databaseId, recordIds }) =>
    withAuthedWorkspace(({ userId, workspaceId }) =>
      Effect.gen(function* () {
        yield* Permissions.checkDatabasePermission(userId, workspaceId, databaseId, "editor");
        return yield* Databases.reorderRecords({ databaseId, recordIds: [...recordIds] });
      }),
    ).pipe(Effect.orDie),
  openRecordAsPage: ({ recordId }) =>
    withAuthedWorkspace(() =>
      Databases.openRecordAsPage(recordId),
    ).pipe(Effect.orDie),
  renameDatabase: (req) =>
    withAuthedWorkspace(({ userId, workspaceId }) =>
      Effect.gen(function* () {
        yield* Permissions.checkDatabasePermission(userId, workspaceId, req.id, "editor");
        return yield* Databases.renameDatabase({ id: req.id, name: req.name });
      }),
    ).pipe(Effect.orDie),
  updateDatabase: (req) =>
    withAuthedWorkspace(({ userId, workspaceId }) =>
      Effect.gen(function* () {
        yield* Permissions.checkDatabasePermission(userId, workspaceId, req.id, "editor");
        return yield* Databases.updateDatabase(req);
      }),
    ).pipe(Effect.orDie),
  deleteField: ({ id }) =>
    withAuthedWorkspace(({ userId, workspaceId }) =>
      Effect.gen(function* () {
        yield* Permissions.checkFieldPermission(userId, workspaceId, id, "editor");
        return yield* Databases.deleteField(id);
      }),
    ).pipe(Effect.orDie),
  reorderDatabases: (req) =>
    withAuthedWorkspace(({ userId, workspaceId }) =>
      Effect.gen(function* () {
        yield* Permissions.checkPagePermission(userId, workspaceId, req.pageId, "editor");
        return yield* Databases.reorderDatabases({ pageId: req.pageId, databaseIds: [...req.databaseIds] });
      }),
    ).pipe(Effect.orDie),
  deleteDatabase: ({ id }) =>
    withAuthedWorkspace(({ userId, workspaceId }) =>
      Effect.gen(function* () {
        yield* Permissions.checkDatabasePermission(userId, workspaceId, id, "editor");
        return yield* Databases.deleteDatabase(id);
      }),
    ).pipe(Effect.orDie),

  // Trash: list / restore / permanent purge
  listTrash: () =>
    withAuthedWorkspace(() => Databases.listTrash).pipe(Effect.orDie),
  restorePage: ({ id }) =>
    withAuthedWorkspace(({ userId, workspaceId }) =>
      Effect.gen(function* () {
        yield* Permissions.checkPagePermission(userId, workspaceId, id, "editor");
        return yield* Pages.restorePage(id);
      }),
    ).pipe(Effect.orDie),
  restoreDatabase: ({ id }) =>
    withAuthedWorkspace(({ userId, workspaceId }) =>
      Effect.gen(function* () {
        yield* Permissions.checkDatabasePermission(userId, workspaceId, id, "editor");
        return yield* Databases.restoreDatabase(id);
      }),
    ).pipe(Effect.orDie),
  restoreRecord: ({ id }) =>
    withAuthedWorkspace(({ userId, workspaceId }) =>
      Effect.gen(function* () {
        yield* Permissions.checkRecordPermission(userId, workspaceId, id, "editor");
        return yield* Databases.restoreRecord(id);
      }),
    ).pipe(Effect.orDie),
  purgePage: ({ id }) =>
    withAuthedWorkspace(({ userId, workspaceId }) =>
      Effect.gen(function* () {
        yield* Permissions.checkPagePermission(userId, workspaceId, id, "editor");
        return yield* Databases.purgePage(id);
      }),
    ).pipe(Effect.orDie),
  purgeDatabase: ({ id }) =>
    withAuthedWorkspace(({ userId, workspaceId }) =>
      Effect.gen(function* () {
        yield* Permissions.checkDatabasePermission(userId, workspaceId, id, "editor");
        return yield* Databases.purgeDatabase(id);
      }),
    ).pipe(Effect.orDie),
  purgeRecord: ({ id }) =>
    withAuthedWorkspace(({ userId, workspaceId }) =>
      Effect.gen(function* () {
        yield* Permissions.checkRecordPermission(userId, workspaceId, id, "editor");
        return yield* Databases.purgeRecord(id);
      }),
    ).pipe(Effect.orDie),

  // Workspaces (use PlatformDb, session-based)
  getMyWorkspaces: () => Effect.gen(function* () {
    const user = yield* getSessionUser;
    return yield* Workspaces.getMyWorkspaces(user.id);
  }).pipe(Effect.orDie),
  createWorkspace: ({ name, slug }) => Effect.gen(function* () {
    const user = yield* getSessionUser;
    return yield* Workspaces.createWorkspace({ userId: user.id, name, slug });
  }).pipe(Effect.orDie),
  joinWorkspaceByToken: ({ inviteToken }) => Effect.gen(function* () {
    const user = yield* getSessionUser;
    return yield* Workspaces.joinWorkspaceByToken({ userId: user.id, inviteToken });
  }).pipe(Effect.orDie),
  getWorkspaceMembers: ({ workspaceId }) =>
    Workspaces.getWorkspaceMembers(workspaceId).pipe(Effect.orDie),
  removeMember: ({ workspaceId, userId }) =>
    Workspaces.removeMember({ workspaceId, userId }).pipe(Effect.orDie),
  regenerateInviteLink: ({ workspaceId }) =>
    Workspaces.regenerateInviteLink(workspaceId).pipe(Effect.orDie),
  inviteMemberByEmail: ({ workspaceId, email }) => Effect.gen(function* () {
    yield* getSessionUser;
    return yield* Workspaces.inviteMemberByEmail({ workspaceId, email });
  }).pipe(Effect.orDie),

  // API keys
  listApiKeys: () => Effect.gen(function* () {
    const user = yield* getSessionUser;
    return yield* ApiKeys.listApiKeys(user.id);
  }).pipe(Effect.orDie),
  createApiKey: ({ name }) => Effect.gen(function* () {
    const user = yield* getSessionUser;
    return yield* ApiKeys.createApiKey({ userId: user.id, name });
  }).pipe(Effect.orDie),
  revokeApiKey: ({ id }) => Effect.gen(function* () {
    const user = yield* getSessionUser;
    return yield* ApiKeys.revokeApiKey({ userId: user.id, id });
  }).pipe(Effect.orDie),

  // Page ACL — Zanzibar-style: structured subjects, atomic writes, revisions.
  listLockedPageIds: () =>
    withAuthedWorkspace(({ userId, workspaceId, role }) =>
      Permissions.listVisibleLockedPageIds(userId, workspaceId, role),
    ).pipe(Effect.orDie),
  getPagePermissions: ({ pageId }) =>
    withAuthedWorkspace(({ userId, workspaceId }) =>
      Effect.gen(function* () {
        yield* Permissions.checkPagePermission(userId, workspaceId, pageId, "viewer");
        return yield* Permissions.getPagePermissions(pageId);
      }),
    ).pipe(Effect.orDie),
  checkPagePermission: ({ pageId, relation }) =>
    withAuthedWorkspace(({ userId, workspaceId }) =>
      Permissions.canAccessPage(userId, workspaceId, pageId, relation).pipe(
        Effect.map((allowed) => ({ allowed })),
      ),
    ).pipe(Effect.orDie),
  writePagePermissions: ({ pageId, set, remove, ifRevision }) =>
    withAuthedWorkspace(({ userId, workspaceId }) =>
      Effect.gen(function* () {
        yield* Permissions.checkPagePermission(userId, workspaceId, pageId, "owner");
        return yield* Permissions.writePagePermissions({
          pageId,
          set,
          remove,
          ifRevision,
        });
      }),
    ).pipe(Effect.orDie),

  // Import/Export
  importNotion: ({ directory }) =>
    withAuthedWorkspace(({ userId, workspaceId }) =>
      Effect.gen(function* () {
        yield* Permissions.requireWorkspaceOwner(userId, workspaceId);
        return yield* ImportExport.importNotion(directory);
      }),
    ).pipe(Effect.orDie),
  exportPage: ({ pageId, includeDatabases }) =>
    withAuthedWorkspace(({ userId, workspaceId }) =>
      Effect.gen(function* () {
        yield* Permissions.checkPagePermission(userId, workspaceId, pageId, "viewer");
        return yield* ImportExport.exportPage(pageId, includeDatabases);
      }),
    ).pipe(Effect.orDie),
  exportDatabase: ({ dbId }) =>
    withAuthedWorkspace(({ userId, workspaceId }) =>
      Effect.gen(function* () {
        yield* Permissions.checkDatabasePermission(userId, workspaceId, dbId, "viewer");
        return yield* ImportExport.exportDatabase(dbId);
      }),
    ).pipe(Effect.orDie),
  exportAll: ({ outputDir }) =>
    withAuthedWorkspace(({ userId, workspaceId }) =>
      Effect.gen(function* () {
        yield* Permissions.requireWorkspaceOwner(userId, workspaceId);
        return yield* ImportExport.exportAll(outputDir);
      }),
    ).pipe(Effect.orDie),
});

// Create RPC router layer
const RpcRouterLive = RpcServer.layerHttpRouter({
  group: AppRpc,
  path: "/api",
  protocol: "http",
});

// Combine all layers: RPC + static files + handlers + serialization + database
const AppLive = Layer.mergeAll(
  RpcRouterLive,
  StaticFilesLive,
  ApiV1Live,
).pipe(
  Layer.provide(rpcHandlersLayer),
  Layer.provide(RpcSerialization.layerJson),
  Layer.provide(SqliteLive),
  Layer.provide(WorkspaceDbLive),
  Layer.provide(PlatformDbLive),
);

// Serve the app with HTTP server
const ServerLive = HttpLayerRouter.serve(AppLive).pipe(
  Layer.provide(NodeHttpServer.layer(createServer, { port: Number(process.env.PORT ?? 3000), host: "0.0.0.0" })),
);

// Run migrations then start server
const program = Effect.gen(function* () {
  yield* runMigrations;
  startBackupScheduler();
  startTrashSweep();
  yield* Effect.logInfo(`Server running on http://localhost:${process.env.PORT ?? 3000}`);
  // Keep the server running
  yield* Effect.never;
});

// Server program - combine migrations with server layer
const main = program.pipe(
  Effect.provide(ServerLive),
);

NodeRuntime.runMain(main as import("effect/Effect").Effect<void, unknown, never>);
